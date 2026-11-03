import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Ellipsis } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { byNewest, expenseRow, formatCurrency, shortDate } from '@commontab/core';
import { Avatar, BackButton, Button, Card, Icon, Text } from '@commontab/ui';
import { BalanceHero } from '../../../../src/components/BalanceHero';
import { ConnectionBanner } from '../../../../src/components/ConnectionBanner';
import { ExpenseRow } from '../../../../src/components/ExpenseRow';
import { SectionHeader } from '../../../../src/components/Section';
import { Screen } from '../../../../src/components/Screen';
import { SyncStatusChip } from '../../../../src/components/SyncStatusChip';
import { useGroup } from '../../../../src/data';

export default function GroupDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, data } = useGroup(id);

  const header = (
    <View className="min-h-touch flex-row items-center justify-between gap-3">
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View className="min-w-0 flex-1 items-center gap-1">
        <Text variant="screen-title" accessibilityRole="header" numberOfLines={1}>{data?.group.name ?? ''}</Text>
        <SyncStatusChip />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Group options" disabled={!data} onPress={() => router.push({ pathname: '/group/[id]/members', params: { id } })} className="h-11 w-11 items-center justify-center rounded-pill bg-card active:opacity-80">
        <Icon icon={Ellipsis} size={22} strokeWidth={2} tone="accent" />
      </Pressable>
    </View>
  );

  if (!data) {
    return (
      <Screen wide>
        {header}
        {ready ? (
          <View className="items-center gap-2 px-6 py-10">
            <Text variant="section" className="text-center">Group not found</Text>
            <Text tone="muted" className="text-center">It may have been removed. Go back and pick another group.</Text>
          </View>
        ) : null}
      </Screen>
    );
  }

  const { group, expenses, settlements, summary } = data;
  const rows = expenses.filter((e) => !e.deletedAt).map((e) => expenseRow(e, group)).sort(byNewest);
  const currency = summary.currencyCode;
  const count = `${summary.expenseCount} ${summary.expenseCount === 1 ? 'expense' : 'expenses'} · ${formatCurrency(summary.totalMinor, currency)} total · ${currency}`;
  const caption = summary.waiting > 0 ? `${count} · includes ${summary.waiting} ${summary.waiting === 1 ? 'change' : 'changes'} waiting to sync` : count;
  const nameOf = (memberId: string) => {
    const member = group.members.find((m) => m.id === memberId);
    return member ? (member.id === group.meMemberID ? 'You' : member.name) : 'Someone';
  };

  return (
    <Screen wide>
      {header}
      <ConnectionBanner />
      {summary.status === 'settled' ? (
        <Card className="items-center gap-2 px-6 py-8">
          <View className="h-14 w-14 items-center justify-center rounded-pill bg-tint">
            <Icon icon={Check} size={28} strokeWidth={2.4} tone="on-tint" />
          </View>
          <Text variant="section" accessibilityRole="header">All settled up</Text>
          <Text tone="muted" className="text-center">Everyone is even in {group.name}.</Text>
        </Card>
      ) : (
        <BalanceHero net={summary.myBalance} currencyCode={currency} scope="group" caption={caption} />
      )}

      {summary.counterparts.length > 0 ? (
        <>
          <SectionHeader title="Balances" />
          <Card className="overflow-hidden">
            {summary.counterparts.map((c, i) => (
              <View key={c.memberID} accessible accessibilityLabel={`${c.name} ${c.direction === 'owesMe' ? 'owes you' : 'you owe'} ${formatCurrency(c.minorUnits, currency)}`} className={`min-h-row flex-row items-center gap-3.5 px-4 py-2.5 ${i < summary.counterparts.length - 1 ? 'border-b border-divider' : ''}`}>
                <Avatar name={c.name} id={c.memberID} />
                <View className="flex-1">
                  <Text variant="body" className="font-semibold">{c.name}</Text>
                  <Text variant="caption" tone="muted" className="text-[13px]">
                    {c.direction === 'owesMe' ? 'owes you ' : 'you owe '}
                    <Text variant="caption" tone={c.direction === 'owesMe' ? 'accent' : 'owe'} className="text-[13px] font-bold">{formatCurrency(c.minorUnits, currency)}</Text>
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {summary.status === 'settled' && settlements.length > 0 ? (
        <>
          <SectionHeader title="Payments" />
          <Card className="overflow-hidden">
            {[...settlements].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((s, i, all) => (
              <View key={s.id} accessible accessibilityLabel={`${nameOf(s.fromID)} paid ${nameOf(s.toID)} ${formatCurrency(s.amountMinor, currency)} on ${shortDate(s.createdAt)}`} className={`min-h-row flex-row items-center justify-between gap-3 px-4 py-2.5 ${i < all.length - 1 ? 'border-b border-divider' : ''}`}>
                <View>
                  <Text variant="body" className="font-semibold">{nameOf(s.fromID)} paid {nameOf(s.toID) === 'You' ? 'you' : nameOf(s.toID)}</Text>
                  <Text variant="caption" tone="muted" className="text-[13px]">{shortDate(s.createdAt)}</Text>
                </View>
                <Text variant="button">{formatCurrency(s.amountMinor, currency)}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Expenses" />
      {rows.length === 0 ? (
        <Card className="items-center gap-1 px-6 py-8">
          <Text variant="body" className="font-semibold">No expenses yet</Text>
          <Text tone="muted" className="text-center">Add the first one to start tracking who owes what.</Text>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {rows.map((row, i) => (
            <ExpenseRow key={row.id} row={row} currencyCode={currency} subtitle="group" divider={i < rows.length - 1} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
