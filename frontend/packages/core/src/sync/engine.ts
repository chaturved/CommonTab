import { ApiError } from '../api/errors';
import type { Api } from '../api/types';
import { afterFailure, nextForGroup, nextRetryAt } from '../outbox/outbox';
import type { OutboxEntry } from '../outbox/types';
import type { LocalSettlement, Storage, Store, SyncError } from '../storage/types';
import type { Clock, ExpenseInput, Random, WireExpense } from '../types';
import { applySnapshot } from './apply';
import { contentOf, iso, syncedExpense, syncedSettlement, withHistory } from './records';
import type { Connectivity, SyncResult, SyncStatus } from './status';

export interface EngineDeps {
  storage: Storage;
  api: Api;
  clock: Clock;
  random: Random;
}

const LAST_SYNCED = 'lastSyncedAt';
const MAX_SENDS_PER_RUN = 500;

/** Thrown inside a push to stop every group when the token is no longer accepted. */
class SessionExpired extends Error {}

/**
 * Push the outbox, then pull snapshots. Safe to run at any time and from several triggers (foreground,
 * connectivity change, a timer, "Retry"): overlapping calls share one run.
 */
export class SyncEngine {
  private connectivity: Connectivity = 'online';
  private running: Promise<SyncResult> | null = null;
  private again = false;
  private listeners = new Set<() => void>();

  constructor(private readonly deps: EngineDeps) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Tell subscribers the store changed (`Actions` calls this after each local change). */
  notify = (): void => { for (const l of this.listeners) l(); };

  /** Run again after sign-in. The queue was only paused; nothing was discarded. */
  resume(): void {
    if (this.connectivity === 'sessionExpired') this.connectivity = 'online';
    this.notify();
  }

  sync(): Promise<SyncResult> {
    if (this.running) {
      this.again = true; // something changed mid-run: go round once more so it is not left waiting
      return this.running;
    }
    const run = (async () => {
      try {
        let result = await this.once();
        for (let i = 0; this.again && i < 3; i++) {
          this.again = false;
          const next = await this.once();
          result = { ...next, sent: result.sent + next.sent };
        }
        return result;
      } finally {
        this.running = null;
        this.again = false;
        this.notify();
      }
    })();
    this.running = run;
    return run;
  }

  async status(): Promise<SyncStatus> {
    const { storage } = this.deps;
    const entries = await storage.listOutbox();
    const waiting = entries.filter((e) => e.status === 'ready').length;
    const failed = entries.filter((e) => e.status === 'failed').length;
    let conflicts = 0;
    for (const group of await storage.listGroups()) {
      conflicts += (await storage.listExpenses(group.id)).filter((e) => e.syncState === 'conflict').length;
    }
    const last = await storage.getMeta(LAST_SYNCED);
    return {
      connectivity: this.connectivity, waiting, failed, conflicts,
      lastSyncedAt: last ? Number(last) : null, nextRetryAt: nextRetryAt(entries),
      chip: failed + conflicts > 0 ? 'failed' : waiting > 0 ? 'waiting' : 'synced',
    };
  }

  // --- one run -------------------------------------------------------------
  private async once(): Promise<SyncResult> {
    if (this.connectivity === 'sessionExpired') return { skipped: 'sessionExpired', sent: 0, pulled: false };
    const outcome = { sent: 0, networkFailure: false };
    try {
      const groups = [...new Set((await this.deps.storage.listOutbox()).map((e) => e.groupId))];
      await Promise.all(groups.map((g) => this.pushGroup(g, outcome)));
      if (!outcome.networkFailure) await this.pull();
    } catch (error) {
      if (error instanceof SessionExpired) return this.expired(outcome.sent);
      if (error instanceof ApiError && error.status === 401) return this.expired(outcome.sent);
      if (error instanceof ApiError && error.isRetryable) outcome.networkFailure = true;
      else throw error;
    }
    this.connectivity = outcome.networkFailure ? await this.probe() : 'online';
    if (!outcome.networkFailure) await this.deps.storage.setMeta(LAST_SYNCED, String(this.deps.clock.now()));
    return { sent: outcome.sent, pulled: !outcome.networkFailure };
  }

  private expired(sent: number): SyncResult {
    this.connectivity = 'sessionExpired';
    return { skipped: 'sessionExpired', sent, pulled: false };
  }

  /** After a failure, ask `/healthz`: no answer is "offline", an unhealthy answer is "server down". */
  private async probe(): Promise<Connectivity> {
    try {
      return (await this.deps.api.healthy()) ? 'online' : 'serverDown';
    } catch {
      return 'offline';
    }
  }

  private async pushGroup(groupId: string, outcome: { sent: number; networkFailure: boolean }): Promise<void> {
    const { storage, clock } = this.deps;
    // Bounded so two people editing the same expense at once can't keep this loop spinning.
    for (let sends = 0; sends < MAX_SENDS_PER_RUN; sends++) {
      const { entry } = nextForGroup(await storage.listOutbox(), groupId, clock.now());
      if (!entry) return;
      const ok = await this.send(entry, outcome);
      if (!ok) return;
    }
  }

  /** Returns false when this group should stop for now (retry later, or the queue is paused). */
  private async send(entry: OutboxEntry, outcome: { sent: number; networkFailure: boolean }): Promise<boolean> {
    const { storage, clock } = this.deps;
    await storage.transaction(async (tx) => {
      const live = (await tx.listOutbox()).find((e) => e.opId === entry.opId);
      if (live) await tx.putOutbox({ ...live, lastAttemptAt: clock.now() });
    });
    try {
      await this.dispatch(entry);
      outcome.sent++;
      this.notify();
      return true;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 401) throw new SessionExpired();
      if (error.isRetryable) {
        outcome.networkFailure = true;
        await this.retryLater(entry, error);
        return false;
      }
      await this.handleRefusal(entry, error);
      return true;
    }
  }

  private async retryLater(entry: OutboxEntry, error: ApiError): Promise<void> {
    await this.deps.storage.transaction(async (tx) => {
      const live = (await tx.listOutbox()).find((e) => e.opId === entry.opId);
      if (live) await tx.putOutbox(afterFailure(live, this.deps, error.message, error.retryAfterMs));
    });
    this.notify();
  }

  // --- sending one entry ---------------------------------------------------
  private async dispatch(entry: OutboxEntry): Promise<void> {
    const { api, storage } = this.deps;
    const p = entry.payload;
    switch (p.kind) {
      case 'group.create': {
        const snapshot = await api.createGroup(p.group);
        return storage.transaction(async (tx) => {
          await this.finish(tx, entry);
          await applySnapshot(tx, snapshot, this.deps.clock.now());
        });
      }
      case 'member.put': {
        await api.putMember(entry.groupId, { id: p.memberID, name: p.name });
        return storage.transaction(async (tx) => void (await this.finish(tx, entry)));
      }
      case 'expense.put': {
        const input: ExpenseInput = { ...p.expense, version: entry.baseVersion };
        const wire = await api.putExpense(entry.groupId, input);
        return storage.transaction(async (tx) => {
          const edited = await this.finish(tx, entry);
          const local = await tx.getExpense(entry.entityId);
          if (edited) {
            // Edited again while this was in flight: the newer entry now builds on the version just stored.
            await tx.putOutbox({ ...edited, baseVersion: wire.version });
            if (local) await tx.putExpense({ ...local, version: wire.version, hasReceipt: wire.hasReceipt });
          } else await tx.putExpense(syncedExpense(wire, local?.history ?? []));
        });
      }
      case 'expense.delete': {
        await api.deleteExpense(entry.groupId, entry.entityId);
        return storage.transaction(async (tx) => {
          const edited = await this.finish(tx, entry);
          const local = await tx.getExpense(entry.entityId);
          if (!edited && local) await tx.putExpense({ ...local, syncState: 'synced', error: undefined });
        });
      }
      case 'settlement.create': {
        const wire = await api.createSettlement(entry.groupId, p.settlement);
        return storage.transaction(async (tx) => {
          await this.finish(tx, entry);
          await tx.putSettlement(syncedSettlement(wire));
        });
      }
    }
  }

  /**
   * Remove the entry that was just acknowledged. If the person changed the same record while it was in
   * flight, that newer entry is returned instead of being removed.
   */
  private async finish(tx: Store, sent: OutboxEntry): Promise<OutboxEntry | null> {
    const entries = await tx.listOutbox();
    const current = entries.find((e) => e.entityId === sent.entityId && e.kind.split('.')[0] === sent.kind.split('.')[0]);
    if (current && current.opId !== sent.opId) return current;
    await tx.deleteOutbox(sent.opId);
    return null;
  }

  // --- refusals --------------------------------------------------------------
  private async handleRefusal(entry: OutboxEntry, error: ApiError): Promise<void> {
    await this.deps.storage.transaction(async (tx) => {
      const live = (await tx.listOutbox()).find((e) => e.opId === entry.opId);
      if (!live) return; // edited or removed while in flight; the newer entry gets its own attempt
      if (entry.kind === 'expense.put' && error.status === 409 && error.code === 'version_conflict' && error.current) {
        await this.resolveVersionConflict(tx, live, error.current);
      } else {
        await this.park(tx, live, error);
      }
    });
    this.notify();
  }

  /** The server refused for good (422, 404, id clash): keep what the person entered and say why. */
  private async park(tx: Store, entry: OutboxEntry, error: ApiError): Promise<void> {
    const reason: SyncError = { status: error.status, code: error.code, message: error.message, ...(error.maxAmountMinor !== undefined && { maxAmountMinor: error.maxAmountMinor }) };
    await tx.putOutbox({ ...entry, status: 'failed', lastError: error.message });
    if (entry.kind === 'expense.put' || entry.kind === 'expense.delete') {
      const record = await tx.getExpense(entry.entityId);
      if (record) await tx.putExpense({ ...record, syncState: 'failed', error: reason });
    } else if (entry.kind === 'settlement.create') {
      const record = await tx.getSettlement(entry.entityId);
      if (record) await tx.putSettlement({ ...record, syncState: 'failed', error: reason } as LocalSettlement);
    } else if (entry.kind === 'group.create') {
      const group = await tx.getGroup(entry.entityId);
      if (group) await tx.putGroup({ ...group, syncState: 'failed' });
    }
  }

  /**
   * Newest edit wins. If this device's edit is newer, send it again on top of the server's version and
   * remember what it replaced. If the other edit is newer (or it was a delete: delete wins), show the
   * server's version, keep this edit aside, and let the person choose "Keep mine" or "Keep theirs".
   */
  private async resolveVersionConflict(tx: Store, entry: OutboxEntry, theirs: WireExpense): Promise<void> {
    const local = await tx.getExpense(entry.entityId);
    if (!local) { await tx.deleteOutbox(entry.opId); return; }
    const mineIsNewer = theirs.deletedAt === null && entry.editedAt >= Date.parse(theirs.updatedAt);
    const at = iso(this.deps.clock.now());
    if (mineIsNewer) {
      await tx.putOutbox({ ...entry, baseVersion: theirs.version, attempts: 0, nextAttemptAt: 0, lastError: null });
      await tx.putExpense({ ...local, version: theirs.version, history: withHistory(local, { at, reason: 'overwritten_by_you', record: theirs }) });
      return;
    }
    await tx.deleteOutbox(entry.opId);
    await tx.putExpense({ ...theirs, syncState: 'conflict', conflict: { mine: contentOf(local, iso(entry.editedAt)) }, history: local.history });
  }

  // --- pull ------------------------------------------------------------------
  private async pull(): Promise<void> {
    const snapshots = await this.deps.api.listGroups();
    for (const snapshot of snapshots) {
      await this.deps.storage.transaction((tx) => applySnapshot(tx, snapshot, this.deps.clock.now()));
    }
    this.notify();
  }
}
