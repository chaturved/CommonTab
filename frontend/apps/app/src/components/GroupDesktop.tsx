import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { byNewest, expenseRow, formatCurrency, type LocalExpense } from '@commontab/core';
import { Button, Card, Icon, Text } from '@commontab/ui';
import { Plus } from 'lucide-react-native';
import type { GroupData } from '../data';
import { useSyncStatus } from '../useSyncStatus';
import { HistoryList, MembersList, NetBalancesList } from './GroupParts';
import { ConnectionBanner } from './ConnectionBanner';
import { ExpenseDetailContent } from './ExpenseDetail';
import { ExpenseRow } from './ExpenseRow';
import { PageHeader } from './PageHeader';

const TABS = ['Expenses', 'Balances', 'Members', 'History'] as const;
type Tab = (typeof TABS)[number];

export function GroupDesktop({ data }: { data: GroupData }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; expense?: string }>();
  const status = useSyncStatus();
  const { group, expenses, summary } = data;
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(params.tab ?? '') ? (params.tab as Tab) : 'Expenses');
  const [selectedId, setSelectedId] = useState<string | null>(params.expense ?? null);
  const currency = summary.currencyCode;
  const live = expenses.filter((e) => !e.deletedAt);
  const rows = live.map((e) => expenseRow(e, group)).sort(byNewest);
  const selected = live.find((e) => e.id === (selectedId ?? rows[0]?.id));
  const offline = status !== null && status.connectivity === 'offline';
  const standing = summary.myBalance > 0 ? `You're owed ${formatCurrency(summary.myBalance, currency)}` : summary.myBalance < 0 ? `You owe ${formatCurrency(-summary.myBalance, currency)}` : 'All settled up';
  const subtitle = tab === 'Balances' ? 'Who owes who' : tab === 'Members' ? `${summary.memberCount} ${summary.memberCount === 1 ? 'member' : 'members'}` : offline && status?.lastSyncedAt
    ? `Showing saved data from ${new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : `${summary.memberCount} ${summary.memberCount === 1 ? 'member' : 'members'} · ${currency} · ${standing}`;

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={subtitle}
        actions={
          <>
            <Button label="Invite" variant="secondary" size="small" onPress={() => router.push({ pathname: '/group/[id]/invite', params: { id: group.id } })} />
            {summary.status === 'needsSettling' ? <Button label="Settle up" variant="secondary" size="small" onPress={() => router.push({ pathname: '/group/[id]/settle', params: { id: group.id } })} /> : null}
            <Button label="Add expense" size="small" icon={<Icon icon={Plus} size={18} strokeWidth={2.4} tone="on-primary" />} onPress={() => router.push({ pathname: '/add-expense', params: { group: group.id } })} />
          </>
        }
      />
      <ConnectionBanner />
      <View accessibilityRole="tablist" className="flex-row gap-1.5 border-b border-divider">
        {TABS.map((name) => {
          const active = name === tab;
          return (
            <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name} accessibilityState={{ selected: active }} onPress={() => setTab(name)} className={`min-h-touch justify-center border-b-2 px-4 ${active ? 'border-accent' : 'border-transparent'}`}>
              <Text variant="body-small" tone={active ? 'accent' : 'muted'} className={`text-sm ${active ? 'font-bold' : 'font-semibold'}`}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'Expenses' ? (
        rows.length === 0 ? (
          <Card className="items-center gap-1 px-6 py-10">
            <Text variant="body" className="font-semibold">No expenses yet</Text>
            <Text tone="muted" className="text-center">Add the first one to start tracking who owes what.</Text>
          </Card>
        ) : (
          <View className="flex-row items-start gap-[22px]">
            <Card className="min-w-0 flex-1 overflow-hidden">
              {rows.map((row, i) => {
                const isSelected = row.id === selected?.id;
                return (
                  <Pressable key={row.id} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => setSelectedId(row.id)} className={`border-l-[3px] ${isSelected ? 'border-accent bg-tint' : 'border-transparent'}`}>
                    <ExpenseRow row={row} currencyCode={currency} subtitle="group" divider={i < rows.length - 1} />
                  </Pressable>
                );
              })}
            </Card>
            {selected ? <ExpensePanel expense={selected} data={data} /> : null}
          </View>
        )
      ) : null}
      {tab === 'Balances' ? <NetBalancesList data={data} /> : null}
      {tab === 'Members' ? <MembersList data={data} contact /> : null}
      {tab === 'History' ? <HistoryList data={data} /> : null}
    </>
  );
}

function ExpensePanel({ expense, data }: { expense: LocalExpense; data: GroupData }) {
  return (
    <Card className="w-[400px] shrink-0 p-[22px]">
      <ExpenseDetailContent expense={expense} data={data} />
    </Card>
  );
}
