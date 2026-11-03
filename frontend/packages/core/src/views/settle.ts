import { formatCurrency } from '../money/format';
import { parseMinorUnits } from '../money/money';
import type { LocalGroup } from '../storage/types';
import type { Balance } from '../ledger/balances';
import { displayName } from './groups';

export function settleLimit(balances: readonly Balance[], fromID: string, toID: string): number {
  const from = balances.find((b) => b.memberID === fromID)?.minorUnits ?? 0;
  const to = balances.find((b) => b.memberID === toID)?.minorUnits ?? 0;
  return Math.max(0, Math.min(-from, to));
}

export interface Direction {
  fromID: string;
  toID: string;
  limit: number;
}

export function directionWith(balances: readonly Balance[], meID: string, otherID: string): Direction | null {
  const theyPay = settleLimit(balances, otherID, meID);
  if (theyPay > 0) return { fromID: otherID, toID: meID, limit: theyPay };
  const iPay = settleLimit(balances, meID, otherID);
  if (iPay > 0) return { fromID: meID, toID: otherID, limit: iPay };
  return null;
}

export type SettlementCheck = { ok: true; amountMinor: number } | { ok: false; message: string };

export function checkSettlement(input: { amountText: string; direction: Direction | null; group: LocalGroup }): SettlementCheck {
  const { amountText, direction, group } = input;
  if (!direction) return { ok: false, message: 'Nobody owes anything between these two people.' };
  let amount: number;
  try {
    amount = amountText.trim() === '' ? 0 : parseMinorUnits(amountText, group.currencyCode);
  } catch {
    return { ok: false, message: 'Enter an amount like 12.50.' };
  }
  if (amount <= 0) return { ok: false, message: 'Enter an amount.' };
  if (amount > direction.limit) {
    const payer = group.members.find((m) => m.id === direction.fromID);
    const payee = group.members.find((m) => m.id === direction.toID);
    const from = payer ? displayName(payer, group.meMemberID) : 'They';
    const to = payee ? displayName(payee, group.meMemberID) : 'them';
    const toText = to === 'You' ? 'you' : to;
    return { ok: false, message: `That's more than is owed. The most ${from} can pay ${toText} is ${formatCurrency(direction.limit, group.currencyCode)}.` };
  }
  return { ok: true, amountMinor: amount };
}

export function halfOf(limit: number): number {
  return Math.floor(limit / 2);
}

export interface Payment {
  fromID: string;
  toID: string;
  minorUnits: number;
}

interface PairInput {
  members: readonly string[];
  expenses: readonly { payerID: string; allocations: readonly { memberID: string; minorUnits: number }[]; deletedAt?: string | null }[];
  settlements: readonly { fromID: string; toID: string; amountMinor: number }[];
}

export function directPayments({ members, expenses, settlements }: PairInput): Payment[] {
  const owes = new Map<string, number>();
  const key = (from: string, to: string) => `${from}>${to}`;
  const add = (from: string, to: string, units: number) => owes.set(key(from, to), (owes.get(key(from, to)) ?? 0) + units);
  for (const e of expenses) {
    if (e.deletedAt) continue;
    for (const a of e.allocations) if (a.memberID !== e.payerID) add(a.memberID, e.payerID, a.minorUnits);
  }
  for (const s of settlements) add(s.fromID, s.toID, -s.amountMinor);
  const payments: Payment[] = [];
  members.forEach((a, i) => {
    for (const b of members.slice(i + 1)) {
      const net = (owes.get(key(a, b)) ?? 0) - (owes.get(key(b, a)) ?? 0);
      if (net > 0) payments.push({ fromID: a, toID: b, minorUnits: net });
      else if (net < 0) payments.push({ fromID: b, toID: a, minorUnits: -net });
    }
  });
  return payments.sort((x, y) => y.minorUnits - x.minorUnits);
}
