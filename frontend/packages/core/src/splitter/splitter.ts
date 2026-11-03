import { CoreError } from '../errors';
import { allocateProportionally, assertMinorUnits, sumMinorUnits } from '../money';
import { commonScale, parseDecimal } from './decimal';

export type SplitMethod = 'equal' | 'exact' | 'percent';

export interface Allocation {
  memberID: string;
  minorUnits: number;
}

export interface AllocateInput {
  method: SplitMethod;
  /** Expense total in minor units. */
  amount: number;
  /** Member ids in display order; the first members receive any leftover cent. */
  participants: readonly string[];
  /** exact: integer minor units as text. percent: decimal percentages as text. Same order as participants. */
  values?: readonly string[];
}

export const MAX_PARTICIPANTS = 20;

function checkParticipants(participants: readonly string[]) {
  if (participants.length === 0 || participants.length > MAX_PARTICIPANTS || new Set(participants).size !== participants.length) {
    throw new CoreError('invalid_participants', `Need 1 to ${MAX_PARTICIPANTS} distinct participants`);
  }
}

/** Split an expense across participants. The shares always add up to `amount` exactly. */
export function allocate({ method, amount, participants, values = [] }: AllocateInput): Allocation[] {
  checkParticipants(participants);
  assertMinorUnits(amount);
  if (amount === 0) throw new CoreError('invalid_amount', 'Amount must be more than zero');
  const units = method === 'equal' ? splitEqual(amount, participants.length) : splitByValues(method, amount, participants.length, values);
  return participants.map((memberID, index) => ({ memberID, minorUnits: units[index] as number }));
}

export function splitEqual(amount: number, count: number): number[] {
  const quotient = Math.floor(amount / count);
  const remainder = amount % count;
  return Array.from({ length: count }, (_, index) => quotient + (index < remainder ? 1 : 0));
}

function splitByValues(method: 'exact' | 'percent', amount: number, count: number, values: readonly string[]): number[] {
  const code = method === 'exact' ? 'invalid_allocation' : 'invalid_percentage';
  if (values.length !== count) throw new CoreError(code, 'One value per participant');
  if (method === 'exact') {
    if (!values.every((v) => /^\d+$/.test(v.trim()))) throw new CoreError(code, 'Exact shares are whole minor units');
    const units = values.map((v) => Number(v.trim()));
    assertMinorUnits(sumMinorUnits(units), 'Invalid shares');
    if (sumMinorUnits(units) !== amount) throw new CoreError(code, 'Exact shares must equal the expense amount');
    return units;
  }
  const { digits, scale } = commonScale(values.map((v) => parseDecimal(v, code)));
  if (digits.reduce((a, b) => a + b, 0n) !== 100n * 10n ** BigInt(scale)) {
    throw new CoreError(code, 'Percentages must total 100');
  }
  return allocateProportionally(BigInt(amount), digits).map(Number);
}
