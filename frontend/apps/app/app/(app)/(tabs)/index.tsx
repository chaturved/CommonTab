import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { byNewest, expenseRow, overallTotals, sortForList } from '@commontab/core';
import { Button, Card, Hero, Icon, Text } from '@commontab/ui';
import { useApp } from '../../../src/app-context';
import { BalanceHero } from '../../../src/components/BalanceHero';
import { ConnectionBanner } from '../../../src/components/ConnectionBanner';
import { ExpenseRow } from '../../../src/components/ExpenseRow';
import { GroupCard } from '../../../src/components/GroupCard';
import { SectionHeader } from '../../../src/components/Section';
import { Screen } from '../../../src/components/Screen';
import { SyncStatusChip } from '../../../src/components/SyncStatusChip';
import { useGroups } from '../../../src/data';
import { PageHeader } from '../../../src/components/PageHeader';
import { useIsDesktop } from '../../../src/layout';
import { useSyncStatus } from '../../../src/useSyncStatus';

const STEPS = [
  ['Create a group', 'A trip, an apartment, a dinner crew'],
  ['Add expenses', 'Split equally, by amount, or by percent'],
  ['Settle up', 'Record payments to clear balances'],
] as const;

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
  const totals = overallTotals(groups.map((g) => g.summary));
  const recent = groups
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
      {ready && groups.length === 0 ? (
        <>
          <Hero>
            <Text variant="label" tone="mint">Welcome, {user?.name.split(' ')[0]}</Text>
            <Text variant="large-title" tone="white" className="text-[26px] leading-[30px]">Split costs without the awkward math.</Text>
            <Text variant="body-small" tone="hero-muted" className="text-sm leading-5">
              Make a group, add what you spend, and CommonTab keeps track of who owes who.
            </Text>
            <Button label="Create a group" variant="hero" icon={<Icon icon={Plus} size={20} strokeWidth={2.4} tone="hero-to" />} onPress={() => router.push('/create-group')} />
            <Button label="Join with a code" variant="hero-outline" onPress={() => router.push('/join')} />
          </Hero>
          <SectionHeader title="How it works" />
          <Card className="overflow-hidden">
            {STEPS.map(([title, body], index) => (
              <View key={title} accessible accessibilityLabel={`Step ${index + 1}: ${title}. ${body}`} className={`min-h-row flex-row items-center gap-3.5 px-4 py-3 ${index < STEPS.length - 1 ? 'border-b border-divider' : ''}`}>
                <View className="h-8 w-8 items-center justify-center rounded-pill bg-tint">
                  <Text variant="caption" tone="on-tint" className="font-bold">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text variant="body" className="font-semibold">{title}</Text>
                  <Text variant="caption" tone="muted" className="text-[13px]">{body}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}
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
                {sortForList(groups.map((g) => g.summary)).map((s) => groups.find((g) => g.group.id === s.id)!).map((g) => (
                  <GroupCard key={g.group.id} data={g} offline={offline} onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.group.id } })} />
                ))}
              </View>
            </View>
            {recent.length > 0 ? (
              <View className={desktop ? 'min-w-0 flex-1 gap-3' : 'gap-4'}>
                <SectionHeader title="Recent expenses" />
                <Card className="overflow-hidden">
                  {recent.map(({ row, currencyCode }, i) => (
                    <ExpenseRow key={row.id} row={row} currencyCode={currencyCode} subtitle="home" divider={i < recent.length - 1} />
                  ))}
                </Card>
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
