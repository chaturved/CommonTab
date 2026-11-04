import { formatCurrency } from '../money/format';
import type { LocalGroup } from '../storage/types';
import type { ActivityEvent } from '../types';
import { dayLabel, localDateTime } from './dates';
import { displayName } from './groups';

export type ActivityFilter = 'all' | 'expenses' | 'payments' | 'groups';

export interface ActivityRow {
  seq: number;
  groupID: string;
  subjectID: string | null;
  actorName: string;
  actorID: string | null;
  title: string;
  subtitle: string;
  filter: Exclude<ActivityFilter, 'all'>;
  at: string;
  day: string;
}

const numberOf = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

function namer(group: LocalGroup) {
  return (id: string | null | undefined): string => {
    const member = group.members.find((m) => m.id === id);
    return member ? displayName(member, group.meMemberID) : 'Someone';
  };
}

const verb = (who: string, past: string, present: string) => (who === 'You' ? present : past);

export function describeActivity(event: ActivityEvent, group: LocalGroup, nowMs: number): ActivityRow {
  const name = namer(group);
  const actor = name(event.actorID);
  const money = (units: number | null) => formatCurrency(units ?? 0, group.currencyCode);
  const merchant = textOf(event.data['merchant']);
  const amount = numberOf(event.data['amountMinor']);
  const previous = numberOf(event.data['previousAmountMinor']);
  const base = { seq: event.seq, groupID: event.groupID, subjectID: event.subjectID, actorName: actor, actorID: event.actorID, at: event.at, day: dayLabel(event.at, nowMs) };
  const row = (filter: ActivityRow['filter'], title: string, subtitle: string): ActivityRow => ({ ...base, filter, title, subtitle });

  switch (event.kind) {
    case 'expense.added': return row('expenses', `${actor} added ${merchant}`, `${group.name} · ${money(amount)} total`);
    case 'expense.edited':
      return row('expenses', `${actor} edited ${merchant}`, previous !== null && previous !== amount ? `${group.name} · amount ${money(previous)} to ${money(amount)}` : `${group.name} · details changed`);
    case 'expense.deleted': return row('expenses', `${actor} deleted ${merchant}`, `${group.name} · ${money(amount)}`);
    case 'payment.recorded': {
      const from = name(textOf(event.data['fromID']));
      const to = name(textOf(event.data['toID']));
      return row('payments', `${from} ${verb(from, 'paid', 'paid')} ${to === 'You' ? 'you' : to}`, `${group.name} · ${money(amount)}`);
    }
    case 'member.joined': return row('groups', `${actor} ${verb(actor, 'joined', 'joined')} ${group.name}`, 'Joined the group');
    case 'member.left': return row('groups', `${actor} left ${group.name}`, 'Left the group');
    case 'member.added': return row('groups', `${actor} added ${textOf(event.data['name'])}`, group.name);
    case 'member.removed': return row('groups', `${textOf(event.data['name'])} was removed from ${group.name}`, `By ${actor}`);
    case 'group.created': return row('groups', `${actor} created ${group.name}`, 'New group');
    case 'group.archived': return row('groups', `${actor} archived ${group.name}`, 'Everyone was settled up');
    case 'group.unarchived': return row('groups', `${actor} brought ${group.name} back`, 'Unarchived');
  }
}

export function activityFeed(events: readonly ActivityEvent[], groups: readonly LocalGroup[], nowMs: number, filter: ActivityFilter = 'all', groupID?: string): ActivityRow[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  return [...events]
    .sort((a, b) => b.seq - a.seq)
    .filter((e) => byId.has(e.groupID) && (!groupID || e.groupID === groupID))
    .map((e) => describeActivity(e, byId.get(e.groupID)!, nowMs))
    .filter((row) => filter === 'all' || row.filter === filter);
}

export interface DayGroup {
  day: string;
  rows: ActivityRow[];
}

export function byDay(rows: readonly ActivityRow[]): DayGroup[] {
  const days: DayGroup[] = [];
  for (const row of rows) {
    const last = days[days.length - 1];
    if (last && last.day === row.day) last.rows.push(row);
    else days.push({ day: row.day, rows: [row] });
  }
  return days;
}

export interface HistoryLine {
  seq: number;
  text: string;
  when: string;
}

export function expenseHistory(events: readonly ActivityEvent[], expenseId: string, group: LocalGroup): HistoryLine[] {
  const name = namer(group);
  return events
    .filter((e) => e.subjectID === expenseId && e.kind.startsWith('expense.'))
    .sort((a, b) => b.seq - a.seq)
    .map((e) => {
      const who = name(e.actorID);
      const amount = numberOf(e.data['amountMinor']);
      const previous = numberOf(e.data['previousAmountMinor']);
      const text = e.kind === 'expense.added'
        ? `${who} added this expense`
        : e.kind === 'expense.deleted'
          ? `${who} deleted this expense`
          : previous !== null && previous !== amount
            ? `${who} edited the amount ${formatCurrency(previous, group.currencyCode)} to ${formatCurrency(amount ?? 0, group.currencyCode)}`
            : `${who} edited this expense`;
      return { seq: e.seq, text, when: localDateTime(e.at) };
    });
}
