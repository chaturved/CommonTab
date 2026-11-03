import { computeBalances, type Balance } from '../ledger/balances';
import { simplifyDebts } from '../ledger/simplify';
import type { LocalExpense, LocalGroup, LocalSettlement } from '../storage/types';
import type { Member } from '../types';

export const displayName = (member: Pick<Member, 'id' | 'name'>, meMemberID: string): string =>
  member.id === meMemberID ? 'You' : member.name;

export interface Counterpart {
  memberID: string;
  name: string;
  direction: 'owesMe' | 'iOwe';
  minorUnits: number;
}

export interface GroupSummary {
  id: string;
  name: string;
  currencyCode: string;
  memberCount: number;
  memberNames: string[];
  balances: Balance[];
  myBalance: number;
  counterparts: Counterpart[];
  expenseCount: number;
  totalMinor: number;
  waiting: number;
  status: 'needsSettling' | 'settled' | 'new';
}

const live = (e: LocalExpense) => !e.deletedAt;

export function summarizeGroup(group: LocalGroup, expenses: readonly LocalExpense[], settlements: readonly LocalSettlement[]): GroupSummary {
  const active = expenses.filter(live);
  const balances = computeBalances({
    members: group.members.map((m) => m.id),
    expenses: active.map((e) => ({ id: e.id, amount: e.amountMinor, payerID: e.payerID, allocations: e.allocations })),
    settlements: settlements.map((s) => ({ id: s.id, fromID: s.fromID, toID: s.toID, minorUnits: s.amountMinor })),
  });
  const nameOf = (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? displayName(member, group.meMemberID) : 'Someone';
  };
  const counterparts: Counterpart[] = [];
  for (const t of simplifyDebts(balances)) {
    if (t.toID === group.meMemberID) counterparts.push({ memberID: t.fromID, name: nameOf(t.fromID), direction: 'owesMe', minorUnits: t.minorUnits });
    else if (t.fromID === group.meMemberID) counterparts.push({ memberID: t.toID, name: nameOf(t.toID), direction: 'iOwe', minorUnits: t.minorUnits });
  }
  const waiting = expenses.filter((e) => e.syncState !== 'synced').length
    + settlements.filter((s) => s.syncState !== 'synced').length
    + (group.syncState !== 'synced' ? 1 : 0);
  const unsettled = balances.some((b) => b.minorUnits !== 0);
  const hasActivity = active.length > 0 || settlements.length > 0;
  return {
    id: group.id,
    name: group.name,
    currencyCode: group.currencyCode,
    memberCount: group.members.length,
    memberNames: [...group.members].sort((a, b) => Number(b.id === group.meMemberID) - Number(a.id === group.meMemberID)).map((m) => displayName(m, group.meMemberID)),
    balances,
    myBalance: balances.find((b) => b.memberID === group.meMemberID)?.minorUnits ?? 0,
    counterparts,
    expenseCount: active.length,
    totalMinor: active.reduce((sum, e) => sum + e.amountMinor, 0),
    waiting,
    status: unsettled ? 'needsSettling' : hasActivity ? 'settled' : 'new',
  };
}

export interface CurrencyTotals {
  currencyCode: string;
  owe: number;
  owed: number;
  net: number;
}

export function overallTotals(summaries: readonly GroupSummary[]): CurrencyTotals[] {
  const byCurrency = new Map<string, CurrencyTotals>();
  for (const s of summaries) {
    const totals = byCurrency.get(s.currencyCode) ?? { currencyCode: s.currencyCode, owe: 0, owed: 0, net: 0 };
    if (s.myBalance < 0) totals.owe += -s.myBalance;
    else totals.owed += s.myBalance;
    totals.net += s.myBalance;
    byCurrency.set(s.currencyCode, totals);
  }
  return [...byCurrency.values()];
}

export function sortForList(summaries: readonly GroupSummary[]): GroupSummary[] {
  return [...summaries].sort((a, b) => Math.abs(b.myBalance) - Math.abs(a.myBalance) || a.name.localeCompare(b.name));
}
