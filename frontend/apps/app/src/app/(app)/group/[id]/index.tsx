import { useRouter } from 'expo-router';
import { useRouteParam } from '@/hooks/useRouteParam';
import { Check, Ellipsis } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { byNewest, expenseRow, formatCurrency } from '@commontab/core';
import { BackButton, Banner, Button, Card, Icon, Text } from '@commontab/ui';
import { BalanceHero } from '@/components/group/BalanceHero';
import { ConnectionBanner } from '@/components/sync/ConnectionBanner';
import { ExpenseRow } from '@/components/expense/ExpenseRow';
import { SectionHeader } from '@/components/ui/Section';
import { Screen } from '@/components/layout/Screen';
import { SyncStatusChip } from '@/components/sync/SyncStatusChip';
import { ClosedGroupBody } from '@/components/group/ClosedGroup';
import { GroupDesktop } from '@/components/group/GroupDesktop';
import { BalancesList, PaymentsList } from '@/components/group/GroupParts';
import { useGroupActions } from '@/hooks/useGroupActions';
import { useGroup } from '@/hooks/useGroups';
import { useIsDesktop } from '@/hooks/useViewport';

export default function GroupDetail() {
  const router = useRouter();
  const id = useRouteParam('id');
  const { ready, data } = useGroup(id);
  const desktop = useIsDesktop();
  const lifecycle = useGroupActions(id ?? '');

  const header = (
    <View className="min-h-touch flex-row items-center justify-between gap-3">
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
      <View className="min-w-0 flex-1 items-center gap-1">
        <Text variant="screen-title" accessibilityRole="header" numberOfLines={1}>{data?.group.name ?? ''}</Text>
        <SyncStatusChip />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Group options" disabled={!data} onPress={() => router.push({ pathname: '/group/[id]/members', params: { id } })} className="h-11 w-11 items-center justify-center rounded-pill bg-card active:opacity-80">
        <Icon icon={Ellipsis} size={22} strokeWidth={2} tone="accent" />
      </Pressable>
    </View>
  );

  if (desktop && data) {
    return (
      <Screen wide>
        <GroupDesktop data={data} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen wide>
        {desktop ? null : header}
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
  const closedHeader = summary.closed ? (
    <View className="min-h-touch flex-row items-center justify-between gap-3">
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
      <Text variant="screen-title" accessibilityRole="header" numberOfLines={1} className="min-w-0 flex-1 text-center">{group.name}</Text>
      <View className="w-11" />
    </View>
  ) : null;
  if (summary.closed) {
    return (
      <Screen wide>
        {closedHeader}
        <ClosedGroupBody data={data} />
      </Screen>
    );
  }
  const rows = expenses.filter((e) => !e.deletedAt).map((e) => expenseRow(e, group)).sort(byNewest);
  const currency = summary.currencyCode;
  const count = `${summary.expenseCount} ${summary.expenseCount === 1 ? 'expense' : 'expenses'} · ${formatCurrency(summary.totalMinor, currency)} total · ${currency}`;
  const caption = summary.waiting > 0 ? `${count} · includes ${summary.waiting} ${summary.waiting === 1 ? 'change' : 'changes'} waiting to sync` : count;

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
          <BalancesList data={data} onSettle={(memberId) => router.push({ pathname: '/group/[id]/settle', params: { id: group.id, with: memberId } })} />
        </>
      ) : null}

      {summary.status === 'settled' && settlements.length > 0 ? (
        <>
          <SectionHeader title="Payments" />
          <PaymentsList data={data} />
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
            <Pressable key={row.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/expense/[id]', params: { id: row.id } })} className="active:opacity-80">
              <ExpenseRow row={row} currencyCode={currency} subtitle="group" divider={i < rows.length - 1} />
            </Pressable>
          ))}
        </Card>
      )}
      {summary.archived ? (
        <>
          <Banner tone="info" message="This group is archived. Add an expense to bring it back, or unarchive it." />
          <Button label="Unarchive group" variant="secondary" loading={lifecycle.busy} onPress={() => void lifecycle.unarchive()} />
        </>
      ) : null}
      {summary.status === 'settled' && !summary.archived ? (
        <Text variant="body-small" tone="muted" className="px-1 text-[13px] leading-[18px]">
          Archiving moves this group out of your list. You can still open it from Groups and add expenses to bring it back.
        </Text>
      ) : null}
      <View className="gap-2.5">
        <Button label="Add expense" onPress={() => router.push({ pathname: '/add-expense', params: { group: group.id } })} />
        {summary.status === 'settled' && !summary.archived ? <Button label="Archive group" variant="secondary" loading={lifecycle.busy} onPress={() => void lifecycle.archive()} /> : null}
      </View>
    </Screen>
  );
}
