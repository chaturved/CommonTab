import { View } from 'react-native';
import { formatCurrency, longDate, shortDate } from '@commontab/core';
import { Avatar, Button, Card, Pill, Text } from '@commontab/ui';
import type { GroupData } from '../data';

const rowClass = (i: number, count: number) => `min-h-row flex-row items-center gap-3.5 px-4 py-2.5 ${i < count - 1 ? 'border-b border-divider' : ''}`;

export function BalancesList({ data, onSettle }: { data: GroupData; onSettle?: (memberId: string) => void }) {
  const { summary } = data;
  const currency = summary.currencyCode;
  if (summary.counterparts.length === 0) {
    return (
      <Card className="items-center gap-1 px-6 py-8">
        <Text variant="body" className="font-semibold">Everyone is even</Text>
        <Text tone="muted" className="text-center">Nobody owes anything in this group right now.</Text>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      {summary.counterparts.map((c, i) => (
        <View key={c.memberID} accessible accessibilityLabel={`${c.name} ${c.direction === 'owesMe' ? 'owes you' : 'you owe'} ${formatCurrency(c.minorUnits, currency)}`} className={rowClass(i, summary.counterparts.length)}>
          <Avatar name={c.name} id={c.memberID} />
          <View className="flex-1">
            <Text variant="body" className="font-semibold">{c.name}</Text>
            <Text variant="caption" tone="muted" className="text-[13px]">
              {c.direction === 'owesMe' ? 'owes you ' : 'you owe '}
              <Text variant="caption" tone={c.direction === 'owesMe' ? 'accent' : 'owe'} className="text-[13px] font-bold">{formatCurrency(c.minorUnits, currency)}</Text>
            </Text>
          </View>
          {onSettle ? <Button label="Settle up" variant="secondary" size="small" accessibilityLabel={`Settle up with ${c.name}`} onPress={() => onSettle(c.memberID)} /> : null}
        </View>
      ))}
    </Card>
  );
}

export function NetBalancesList({ data }: { data: GroupData }) {
  const { group, summary } = data;
  const currency = summary.currencyCode;
  return (
    <Card className="overflow-hidden">
      {group.members.map((member, i) => {
        const balance = summary.balances.find((b) => b.memberID === member.id)?.minorUnits ?? 0;
        const you = member.id === group.meMemberID;
        const amount = formatCurrency(Math.abs(balance), currency);
        const words = balance > 0 ? (you ? 'gets back' : 'is owed') : balance < 0 ? (you ? 'owe' : 'owes') : 'settled up';
        return (
          <View key={member.id} accessible accessibilityLabel={`${you ? 'You' : member.name} ${words}${balance === 0 ? '' : ` ${amount}`}`} className={`h-[68px] flex-row items-center gap-3.5 px-5 ${i < group.members.length - 1 ? 'border-b border-divider' : ''}`}>
            <Avatar name={member.name} id={member.id} size="md" />
            <View className="flex-1">
              <Text variant="body" className="text-base font-semibold">{you ? 'You' : member.name}</Text>
              <Text variant="caption" tone="muted" className="text-[13px]">{words}</Text>
            </View>
            {balance === 0 ? null : <Text variant="button" tone={balance > 0 ? 'accent' : 'owe'} className="text-[17px]">{amount}</Text>}
          </View>
        );
      })}
    </Card>
  );
}

export function MembersList({ data, contact }: { data: GroupData; contact?: boolean }) {
  const { group, summary } = data;
  return (
    <Card className="overflow-hidden">
      {group.members.map((member, i) => {
        const balance = summary.balances.find((b) => b.memberID === member.id)?.minorUnits ?? 0;
        const you = member.id === group.meMemberID;
        const owner = member.id === group.ownerID;
        const amount = formatCurrency(Math.abs(balance), group.currencyCode);
        const words = balance > 0 ? `Owed ${amount}` : balance < 0 ? `Owes ${amount}` : 'Settled up';
        if (contact) {
          return (
            <View key={member.id} accessible accessibilityLabel={`${you ? 'You' : member.name}${owner ? ', owner' : ''}, ${member.email ?? 'no account yet'}`} className={`h-[68px] flex-row items-center gap-3.5 px-5 ${i < group.members.length - 1 ? 'border-b border-divider' : ''}`}>
              <Avatar name={member.name} id={member.id} size="md" />
              <View className="flex-1">
                <Text variant="body" className="text-base font-semibold">{you ? 'You' : member.name}{owner ? ' · owner' : ''}</Text>
                <Text variant="caption" tone="muted" className="text-[13px]">{member.email ?? (member.userID ? 'Has an account' : 'No account yet')}</Text>
              </View>
            </View>
          );
        }
        return (
          <View key={member.id} accessible accessibilityLabel={`${you ? 'You' : member.name}${owner ? ', owner' : ''}, ${words}`} className={`min-h-row-tall flex-row items-center gap-3.5 px-4 py-2 ${i < group.members.length - 1 ? 'border-b border-divider' : ''}`}>
            <Avatar name={member.name} id={member.id} size="md" />
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text variant="body" className="font-semibold">{you ? 'You' : member.name}</Text>
                {owner ? <Pill label="Owner" tone="neutral" /> : null}
              </View>
              <Text variant="caption" tone={balance < 0 ? 'owe' : balance > 0 ? 'accent' : 'muted'} className="text-[13px]">{words}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export function PaymentsList({ data }: { data: GroupData }) {
  const { group, settlements, summary } = data;
  const nameOf = (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? (member.id === group.meMemberID ? 'You' : member.name) : 'Someone';
  };
  const sorted = [...settlements].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return (
    <Card className="overflow-hidden">
      {sorted.map((s, i) => (
        <View key={s.id} accessible accessibilityLabel={`${nameOf(s.fromID)} paid ${nameOf(s.toID)} ${formatCurrency(s.amountMinor, summary.currencyCode)} on ${shortDate(s.createdAt)}`} className={`${rowClass(i, sorted.length)} justify-between`}>
          <View>
            <Text variant="body" className="font-semibold">{nameOf(s.fromID)} paid {nameOf(s.toID) === 'You' ? 'you' : nameOf(s.toID)}</Text>
            <Text variant="caption" tone="muted" className="text-[13px]">{shortDate(s.createdAt)}</Text>
          </View>
          <Text variant="button">{formatCurrency(s.amountMinor, summary.currencyCode)}</Text>
        </View>
      ))}
    </Card>
  );
}

interface HistoryEvent {
  key: string;
  at: string;
  title: string;
  subtitle: string;
}

export function historyEvents(data: GroupData): HistoryEvent[] {
  const { group, expenses, settlements, summary } = data;
  const nameOf = (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? (member.id === group.meMemberID ? 'You' : member.name) : 'Someone';
  };
  const events: HistoryEvent[] = [];
  for (const s of settlements) {
    events.push({ key: `s${s.id}`, at: s.createdAt, title: `${nameOf(s.fromID)} paid ${nameOf(s.toID) === 'You' ? 'you' : nameOf(s.toID)} ${formatCurrency(s.amountMinor, summary.currencyCode)}`, subtitle: longDate(s.createdAt) });
  }
  for (const e of expenses) {
    if (e.deletedAt) events.push({ key: `d${e.id}`, at: e.deletedAt, title: `${e.merchant} was deleted`, subtitle: `${formatCurrency(e.amountMinor, summary.currencyCode)} · ${longDate(e.deletedAt)}` });
    for (const [i, h] of e.history.entries()) {
      const what = h.reason === 'edited_elsewhere' ? 'was edited by someone else' : h.reason === 'you_chose_theirs' ? 'kept the other version' : 'replaced the other version';
      events.push({ key: `h${e.id}${i}`, at: h.at, title: `${e.merchant} ${what}`, subtitle: longDate(h.at) });
    }
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function HistoryList({ data }: { data: GroupData }) {
  const events = historyEvents(data);
  if (events.length === 0) {
    return (
      <Card className="items-center gap-1 px-6 py-8">
        <Text variant="body" className="font-semibold">No history yet</Text>
        <Text tone="muted" className="text-center">Payments, edits and deleted expenses show up here.</Text>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      {events.map((e, i) => (
        <View key={e.key} accessible accessibilityLabel={`${e.title}, ${e.subtitle}`} className={rowClass(i, events.length)}>
          <View className="flex-1">
            <Text variant="body" className="font-semibold">{e.title}</Text>
            <Text variant="caption" tone="muted" className="text-[13px]">{e.subtitle}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}
