import { enqueue } from '../outbox/outbox';
import type { OutboxContext } from '../outbox/outbox';
import type { LocalExpense, LocalGroup, LocalSettlement, Storage, Store } from '../storage/types';
import type { ExpenseContent, Member } from '../types';
import { allocationsFor, contentOf, foreignOf, iso, toContent, withHistory } from './records';

export interface ActionDeps extends OutboxContext {
  storage: Storage;
  notify(): void;
}

export interface NewGroup {
  id?: string;
  name: string;
  currencyCode: string;
  members: { id?: string; name: string }[];
  meIndex: number;
  localOnly?: boolean;
}

export type ExpenseDraft = Omit<ExpenseContent, 'id'> & { id?: string };

export class Actions {
  constructor(private readonly deps: ActionDeps) {}

  private get ctx(): OutboxContext { return { clock: this.deps.clock, random: this.deps.random }; }
  private nowIso(): string { return iso(this.deps.clock.now()); }

  async createGroup(input: NewGroup): Promise<LocalGroup> {
    const { storage, random } = this.deps;
    const id = input.id ?? random.uuid();
    const members: Member[] = input.members.map((m) => ({ id: m.id ?? random.uuid(), name: m.name, userID: null, email: null }));
    const me = members[input.meIndex];
    if (!me) throw new Error('meIndex must point at one of the members');
    const group: LocalGroup = {
      id, name: input.name, currencyCode: input.currencyCode, ownerID: me.id, meMemberID: me.id, version: null,
      members, syncState: 'pending', localOnly: input.localOnly ?? false,
    };
    await storage.transaction(async (tx) => {
      await tx.putGroup(group);
      if (!group.localOnly) await this.enqueueGroup(tx, group);
    });
    this.deps.notify();
    return group;
  }

  async deleteLocalGroup(groupId: string): Promise<void> {
    await this.deps.storage.deleteGroup(groupId);
    this.deps.notify();
  }

  async uploadGroup(groupId: string): Promise<void> {
    await this.deps.storage.transaction(async (tx) => {
      const group = await tx.getGroup(groupId);
      if (!group || !group.localOnly) return;
      await tx.putGroup({ ...group, localOnly: false });
      await this.enqueueGroup(tx, group);
      for (const e of (await tx.listExpenses(groupId)).filter((x) => x.deletedAt === null)) {
        await enqueue(tx, this.ctx, { groupId, entityId: e.id, baseVersion: null, payload: { kind: 'expense.put', expense: { ...toContent(contentOf(e)), version: null } } });
      }
      for (const s of await tx.listSettlements(groupId)) {
        const { id, fromID, toID, amountMinor } = s;
        await enqueue(tx, this.ctx, { groupId, entityId: id, baseVersion: null, payload: { kind: 'settlement.create', settlement: { id, fromID, toID, amountMinor } } });
      }
    });
    this.deps.notify();
  }

  private async enqueueGroup(tx: Store, group: LocalGroup) {
    await enqueue(tx, this.ctx, {
      groupId: group.id, entityId: group.id, baseVersion: null,
      payload: { kind: 'group.create', group: { id: group.id, name: group.name, currencyCode: group.currencyCode, members: group.members.map((m) => ({ id: m.id, name: m.name })), meMemberID: group.meMemberID } },
    });
  }

  async putMember(groupId: string, member: { id?: string; name: string }): Promise<Member> {
    const id = member.id ?? this.deps.random.uuid();
    const saved = await this.deps.storage.transaction(async (tx) => {
      const group = await tx.getGroup(groupId);
      if (!group) throw new Error('Unknown group');
      const existing = group.members.find((m) => m.id === id);
      const next: Member = { id, name: member.name, userID: existing?.userID ?? null, email: existing?.email ?? null };
      await tx.putGroup({ ...group, members: existing ? group.members.map((m) => (m.id === id ? next : m)) : [...group.members, next] });
      if (!group.localOnly) await enqueue(tx, this.ctx, { groupId, entityId: id, baseVersion: null, payload: { kind: 'member.put', memberID: id, name: member.name } });
      return next;
    });
    this.deps.notify();
    return saved;
  }

  async saveExpense(groupId: string, draft: ExpenseDraft): Promise<LocalExpense> {
    const { storage, random } = this.deps;
    const id = draft.id ?? random.uuid();
    const content: ExpenseContent = { ...draft, id };
    const allocations = allocationsFor(content);
    const saved = await storage.transaction(async (tx) => {
      const group = await tx.getGroup(groupId);
      if (!group) throw new Error('Unknown group');
      const existing = await tx.getExpense(id);
      if (existing?.syncState === 'conflict') throw new Error('Resolve the conflict before editing');
      if (existing?.deletedAt) throw new Error('This expense was deleted');
      const record: LocalExpense = {
        id, groupID: groupId, merchant: content.merchant, occurredAt: content.occurredAt, category: content.category,
        notes: content.notes, amountMinor: content.amountMinor, payerID: content.payerID, method: content.method,
        allocations, values: content.values, version: existing?.version ?? 0, hasReceipt: existing?.hasReceipt ?? false,
        updatedAt: this.nowIso(), deletedAt: null, syncState: 'pending', history: existing?.history ?? [], ...foreignOf(content),
      };
      await tx.putExpense(record);
      if (!group.localOnly) {
        await enqueue(tx, this.ctx, { groupId, entityId: id, baseVersion: record.version === 0 ? null : record.version, payload: { kind: 'expense.put', expense: { ...toContent(content), version: null } } });
      }
      return record;
    });
    this.deps.notify();
    return saved;
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await this.deps.storage.transaction(async (tx) => {
      const existing = await tx.getExpense(expenseId);
      if (!existing || existing.deletedAt) return;
      const group = await tx.getGroup(existing.groupID);
      if (group?.localOnly) { await tx.deleteExpense(expenseId); return; }
      const queued = await enqueue(tx, this.ctx, {
        groupId: existing.groupID, entityId: expenseId, baseVersion: existing.version === 0 ? null : existing.version, payload: { kind: 'expense.delete' },
      });
      if (!queued) await tx.deleteExpense(expenseId);
      else await tx.putExpense({ ...existing, deletedAt: this.nowIso(), updatedAt: this.nowIso(), syncState: 'pending', conflict: undefined, error: undefined });
    });
    this.deps.notify();
  }

  async addSettlement(groupId: string, input: { id?: string; fromID: string; toID: string; amountMinor: number }): Promise<LocalSettlement> {
    const id = input.id ?? this.deps.random.uuid();
    const record: LocalSettlement = { id, groupID: groupId, fromID: input.fromID, toID: input.toID, amountMinor: input.amountMinor, createdAt: this.nowIso(), syncState: 'pending' };
    await this.deps.storage.transaction(async (tx) => {
      const group = await tx.getGroup(groupId);
      if (!group) throw new Error('Unknown group');
      await tx.putSettlement(record);
      if (!group.localOnly) {
        await enqueue(tx, this.ctx, { groupId, entityId: id, baseVersion: null, payload: { kind: 'settlement.create', settlement: { id, fromID: input.fromID, toID: input.toID, amountMinor: input.amountMinor } } });
      }
    });
    this.deps.notify();
    return record;
  }

  /**
   * Settle a conflict. "mine" sends the person's edit again on top of the server's version (for a delete
   * that is "Restore"); "theirs" keeps the server's version and files the person's edit in the history.
   */
  async resolveConflict(expenseId: string, choice: 'mine' | 'theirs'): Promise<void> {
    await this.deps.storage.transaction(async (tx) => {
      const record = await tx.getExpense(expenseId);
      if (!record || record.syncState !== 'conflict' || !record.conflict) return;
      const { mine } = record.conflict;
      const at = this.nowIso();
      if (choice === 'theirs') {
        await tx.putExpense({ ...record, syncState: 'synced', conflict: undefined, history: withHistory(record, { at, reason: 'you_chose_theirs', record: mine }) });
        return;
      }
      const restored: LocalExpense = {
        ...record, merchant: mine.merchant, occurredAt: mine.occurredAt, category: mine.category, notes: mine.notes,
        amountMinor: mine.amountMinor, payerID: mine.payerID, method: mine.method, allocations: mine.allocations,
        values: mine.values, currencyCode: mine.currencyCode ?? null, originalMinor: mine.originalMinor ?? null, rateMicros: mine.rateMicros ?? null,
        deletedAt: null, updatedAt: at, syncState: 'pending', conflict: undefined,
        history: withHistory(record, { at, reason: 'overwritten_by_you', record: { ...record } }),
      };
      await tx.putExpense(restored);
      await enqueue(tx, this.ctx, { groupId: record.groupID, entityId: expenseId, baseVersion: record.version, payload: { kind: 'expense.put', expense: { ...toContent(mine), version: null } } });
    });
    this.deps.notify();
  }

  async discardFailed(opId: string): Promise<void> {
    await this.deps.storage.transaction(async (tx) => {
      const entry = (await tx.listOutbox()).find((e) => e.opId === opId);
      if (!entry || entry.status !== 'failed') return;
      await tx.deleteOutbox(opId);
      if (entry.kind === 'settlement.create') await tx.deleteSettlement(entry.entityId);
      else if (entry.kind === 'expense.put' && entry.baseVersion === null) await tx.deleteExpense(entry.entityId);
      else if (entry.kind === 'expense.put' || entry.kind === 'expense.delete') {
        const record = await tx.getExpense(entry.entityId);
        if (record) await tx.putExpense({ ...record, syncState: 'synced', error: undefined });
      } else if (entry.kind === 'group.create') {
        // The server refused the group, so everything queued behind it can't land either: keep it on this phone.
        for (const other of await tx.listOutbox()) if (other.groupId === entry.groupId) await tx.deleteOutbox(other.opId);
        const group = await tx.getGroup(entry.groupId);
        if (group) await tx.putGroup({ ...group, localOnly: true, syncState: 'pending' });
      }
    });
    this.deps.notify();
  }
}
