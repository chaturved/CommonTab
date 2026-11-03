import type { Store } from '../storage/types';
import type { GroupSnapshot } from '../types';
import { groupFromSnapshot, iso, sameContent, syncedExpense, syncedSettlement, withHistory } from './records';

/**
 * Apply a server snapshot to the local store (the whole call runs in the caller's transaction).
 * Records that are `synced` are replaced; `pending`, `failed` and `conflict` records are never overwritten.
 * People added or renamed on this device whose push has not landed yet are kept.
 */
export async function applySnapshot(tx: Store, snapshot: GroupSnapshot, nowMs: number): Promise<void> {
  const outbox = await tx.listOutbox();
  const local = await tx.getGroup(snapshot.id);
  const waiting = new Map<string, string>();
  for (const entry of outbox) if (entry.payload.kind === 'member.put' && entry.groupId === snapshot.id) waiting.set(entry.payload.memberID, entry.payload.name);
  const members = snapshot.members.map((m) => (waiting.has(m.id) ? { ...m, name: waiting.get(m.id)! } : m));
  for (const m of local?.members ?? []) {
    if (waiting.has(m.id) && !members.some((x) => x.id === m.id)) members.push(m);
  }
  const group = groupFromSnapshot(snapshot, local);
  const groupCreateWaiting = outbox.some((e) => e.kind === 'group.create' && e.groupId === snapshot.id);
  await tx.putGroup({ ...group, members, syncState: groupCreateWaiting ? 'pending' : 'synced' });

  for (const wire of [...snapshot.expenses, ...snapshot.deletedExpenses]) {
    const existing = await tx.getExpense(wire.id);
    if (!existing) { await tx.putExpense(syncedExpense(wire)); continue; }
    if (existing.syncState !== 'synced' || wire.version < existing.version) continue;
    const changed = wire.version > existing.version && !sameContent(existing, wire);
    const history = changed ? withHistory(existing, { at: iso(nowMs), reason: 'edited_elsewhere', record: existing }) : existing.history;
    await tx.putExpense(syncedExpense(wire, history));
  }
  for (const wire of snapshot.settlements) {
    const existing = await tx.getSettlement(wire.id);
    if (!existing || existing.syncState === 'synced') await tx.putSettlement(syncedSettlement(wire));
  }
}
