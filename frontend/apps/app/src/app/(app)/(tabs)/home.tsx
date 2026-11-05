import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { byNewest, expenseRow, overallTotals, sortForList } from '@commontab/core';
import { Button, Card, Icon, Text } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { BalanceHero } from '@/components/group/BalanceHero';
import { ConnectionBanner } from '@/components/sync/ConnectionBanner';
import { FirstRun } from '@/components/home/FirstRun';
import { ExpenseRow } from '@/components/expense/ExpenseRow';
import { GroupCard } from '@/components/group/GroupCard';
import { SectionHeader } from '@/components/ui/Section';
import { Screen } from '@/components/layout/Screen';
import { SyncStatusChip } from '@/components/sync/SyncStatusChip';
import { useGroups } from '@/hooks/useGroups';
import { PageHeader } from '@/components/ui/PageHeader';
import { useIsDesktop } from '@/hooks/useViewport';
import { useSyncStatus } from '@/hooks/useSyncStatus';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function Home() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { user } = useApp();
  const { ready, groups } = useGroups();
  const status = useSyncStatus();
  const offline = status !== null && status.connectivity !== 'online' && status.connectivity !== 'sessionExpired';
  const live = groups.filter((g) => g.summary.active);
  const totals = overallTotals(live.map((g) => g.summary));
  const recent = live
    .flatMap((g) => g.expenses.filter((e) => !e.deletedAt).map((e) => ({ row: expenseRow(e, g.group), currencyCode: g.group.currencyCode })))
    .sort((a, b) => byNewest(a.row, b.row))
    .slice(0, 5);

  return (
    <Screen wide tabs>
      {desktop ? (
        <PageHeader title="Home" subtitle={`${greeting()}, ${user?.name.split(' ')[0] ?? ''}`} />
      ) : (
        <View className="min-h-touch flex-row items-center justify-between px-1">
          <Text variant="large-title" accessibilityRole="header">CommonTab</Text>
          <SyncStatusChip />
        </View>
      )}
      <ConnectionBanner />
      {ready && groups.length === 0 ? <FirstRun name={user?.name.split(' ')[0] ?? ''} /> : null}
      {groups.length > 0 ? (
        <>
          {totals.map((t) => (
            <BalanceHero
              key={t.currencyCode}
              net={t.net}
              currencyCode={t.currencyCode}
              scope="overall"
              owe={t.owe}
              owed={t.owed}
              caption={offline && status?.lastSyncedAt ? `As of ${clock(status.lastSyncedAt)} · may not include changes from others` : undefined}
            />
          ))}
          <View className={desktop ? 'flex-row items-start gap-[22px]' : 'gap-4'}>
            <View className={desktop ? 'min-w-0 flex-1 gap-3' : 'gap-4'}>
              <SectionHeader
                title="Groups"
                action={<Button label="Create group" variant="ghost" size="small" icon={<Icon icon={Plus} size={18} strokeWidth={2.4} tone="accent" />} onPress={() => router.push('/create-group')} />}
              />
              <View className="gap-2.5">
                {sortForList(live.map((g) => g.summary)).map((s) => groups.find((g) => g.group.id === s.id)!).map((g) => (
                  <GroupCard key={g.group.id} data={g} offline={offline} onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.group.id } })} />
                ))}
              </View>
            </View>
            <View className={desktop ? 'min-w-0 flex-1 gap-3' : 'gap-4'}>
              <SectionHeader title="Recent expenses" />
              {recent.length > 0 ? (
                <Card className="overflow-hidden">
                  {recent.map(({ row, currencyCode }, i) => (
                    <ExpenseRow key={row.id} row={row} currencyCode={currencyCode} subtitle="home" divider={i < recent.length - 1} />
                  ))}
                </Card>
              ) : (
                <Card className="items-start gap-3 p-5">
                  <View className="gap-1">
                    <Text variant="body" className="font-semibold">No expenses yet</Text>
                    <Text variant="body-small" tone="muted">Add one and it shows up here.</Text>
                  </View>
                  <Button label="Add expense" variant="secondary" size="small" onPress={() => router.push('/add-expense')} />
                </Card>
              )}
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
