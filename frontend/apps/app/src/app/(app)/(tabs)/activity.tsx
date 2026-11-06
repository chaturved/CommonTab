import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { activityFeed, byDay, expenseRow, formatCurrency, type ActivityFilter, type ActivityRow } from '@commontab/core';
import { Avatar, Card, Text } from '@commontab/ui';
import { ConnectionBanner } from '@/components/sync/ConnectionBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Eyebrow } from '@/components/ui/Section';
import { Screen } from '@/components/layout/Screen';
import { SyncStatusChip } from '@/components/sync/SyncStatusChip';
import { useActivityEvents } from '@/hooks/useActivityEvents';
import { useGroups } from '@/hooks/useGroups';
import { useNow } from '@/hooks/useNow';
import type { GroupData } from '@/types/group';
import { useIsDesktop } from '@/hooks/useViewport';

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'payments', label: 'Payments' },
  { key: 'groups', label: 'Group changes' },
];

function amountFor(row: ActivityRow, groups: GroupData[]): { amount: string; words: string; tone: 'accent' | 'owe' } | null {
  if (row.filter !== 'expenses' || !row.subjectID) return null;
  const data = groups.find((g) => g.group.id === row.groupID);
  const expense = data?.expenses.find((e) => e.id === row.subjectID && !e.deletedAt);
  if (!data || !expense) return null;
  const position = expenseRow(expense, data.group).position;
  if (position.kind === 'none') return null;
  return { amount: formatCurrency(position.minorUnits, data.group.currencyCode), words: position.kind === 'lent' ? 'you lent' : 'you owe', tone: position.kind === 'lent' ? 'accent' : 'owe' };
}

export default function Activity() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { groups } = useGroups();
  const { ready, events } = useActivityEvents();
  const now = useNow();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const rows = activityFeed(events, groups.map((g) => g.group), now, filter);
  const days = byDay(rows);

  const open = (row: ActivityRow) => {
    const expense = row.subjectID ? groups.flatMap((g) => g.expenses).find((e) => e.id === row.subjectID && !e.deletedAt) : undefined;
    if (row.filter === 'expenses' && expense) router.push({ pathname: '/expenses/[id]', params: { id: expense.id } });
    else router.push({ pathname: '/groups/[id]', params: { id: row.groupID } });
  };

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" className="grow-0" contentContainerClassName="gap-2">
      {FILTERS.map((f) => {
        const on = f.key === filter;
        return (
          <Pressable key={f.key} accessibilityRole="tab" accessibilityLabel={f.label} accessibilityState={{ selected: on }} onPress={() => setFilter(f.key)} className={`min-h-touch justify-center rounded-pill px-4 ${on ? 'bg-primary' : 'bg-card'}`}>
            <Text variant="body-small" tone={on ? 'on-primary' : 'fg-soft'} className="font-semibold">{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const list = ready && rows.length === 0 ? (
    <Card className="items-center gap-1 px-6 py-10">
      <Text variant="section" className="text-center">{filter === 'all' ? 'Nothing here yet' : 'Nothing to show'}</Text>
      <Text tone="muted" className="text-center">{filter === 'all' ? 'Changes from people in your groups will show up here.' : 'Try another filter.'}</Text>
    </Card>
  ) : (
    <View className="gap-1.5">
      {days.map((d) => (
        <View key={d.day} className="gap-1.5">
          <Eyebrow>{d.day.toUpperCase()}</Eyebrow>
          <Card className="overflow-hidden">
            {d.rows.map((row, i) => {
              const trailing = amountFor(row, groups);
              return (
                <Pressable key={row.seq} accessibilityRole="button" accessibilityLabel={`${row.title}, ${row.subtitle}${trailing ? `, ${trailing.words} ${trailing.amount}` : ''}`} onPress={() => open(row)} className={`min-h-row-tall flex-row items-center gap-3.5 px-4 py-2.5 active:opacity-80 ${i < d.rows.length - 1 ? 'border-b border-divider' : ''}`}>
                  <Avatar name={groups.find((g) => g.group.id === row.groupID)?.group.members.find((m) => m.id === row.actorID)?.name ?? '?'} id={row.actorID ?? undefined} />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text variant="body" className="font-semibold" numberOfLines={1}>{row.title}</Text>
                    <Text variant="caption" tone="muted" className="text-[13px]" numberOfLines={1}>{row.subtitle}</Text>
                  </View>
                  {trailing ? (
                    <View className="items-end gap-0.5">
                      <Text variant="button" tone={trailing.tone}>{trailing.amount}</Text>
                      <Text variant="caption" tone="muted">{trailing.words}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );

  return (
    <Screen wide tabs>
      {desktop ? (
        <PageHeader title="Activity" subtitle="Everything across your groups" />
      ) : (
        <View className="min-h-touch flex-row items-center justify-between px-1">
          <Text variant="large-title" accessibilityRole="header">Activity</Text>
          <SyncStatusChip />
        </View>
      )}
      <ConnectionBanner />
      {chips}
      {list}
    </Screen>
  );
}
