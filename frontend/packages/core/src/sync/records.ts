import { allocate } from '../splitter';
import type { LocalContent, LocalExpense, LocalGroup, LocalSettlement } from '../storage/types';
import type { ExpenseContent, GroupSnapshot, WireExpense, WireSettlement } from '../types';

export const HISTORY_LIMIT = 10;

export const iso = (ms: number): string => new Date(ms).toISOString();

/** Local copy of the splitter's result, so a pending expense shows the right shares before the server sees it. */
export function allocationsFor(content: ExpenseContent) {
  return allocate({
    method: content.method === 'percentage' ? 'percent' : content.method,
    amount: content.amountMinor,
    participants: content.participants,
    values: content.values,
  });
}

/** What a person wrote in an expense, taken back out of a stored record. */
export function contentOf(record: WireExpense, editedAt: string = record.updatedAt): LocalContent {
  return {
    id: record.id, groupID: record.groupID, merchant: record.merchant, occurredAt: record.occurredAt,
    category: record.category, notes: record.notes, amountMinor: record.amountMinor, payerID: record.payerID,
    method: record.method, participants: record.allocations.map((a) => a.memberID), values: record.values,
    allocations: record.allocations, editedAt,
  };
}

export function sameContent(a: WireExpense, b: WireExpense): boolean {
  const pick = (e: WireExpense) => JSON.stringify([e.merchant, e.occurredAt, e.category, e.notes, e.amountMinor, e.payerID, e.method, e.allocations, e.values, e.deletedAt]);
  return pick(a) === pick(b);
}

export function withHistory(record: LocalExpense, entry: LocalExpense['history'][number]): LocalExpense['history'] {
  return [entry, ...record.history].slice(0, HISTORY_LIMIT);
}

export function syncedExpense(wire: WireExpense, history: LocalExpense['history'] = []): LocalExpense {
  return { ...wire, syncState: 'synced', history };
}

export function syncedSettlement(wire: WireSettlement): LocalSettlement {
  return { ...wire, syncState: 'synced' };
}

export function groupFromSnapshot(snapshot: GroupSnapshot, local?: LocalGroup): LocalGroup {
  return {
    id: snapshot.id, name: snapshot.name, currencyCode: snapshot.currencyCode, ownerID: snapshot.ownerID,
    meMemberID: snapshot.meMemberID, version: snapshot.version, members: snapshot.members,
    syncState: 'synced', localOnly: local?.localOnly ?? false,
  };
}

/** Only the fields the API accepts; local bookkeeping stays on the device. */
export function toContent(c: ExpenseContent): ExpenseContent {
  return {
    id: c.id, merchant: c.merchant, occurredAt: c.occurredAt, category: c.category, notes: c.notes,
    amountMinor: c.amountMinor, payerID: c.payerID, method: c.method, participants: c.participants, values: c.values,
  };
}
