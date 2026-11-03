import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { byNewest, expenseRow, formatCurrency, longDate, type LocalExpense } from '@commontab/core';
import { Avatar, Button, Card, Icon, Text } from '@commontab/ui';
import { Plus } from 'lucide-react-native';
import type { GroupData } from '../data';
import { useSyncStatus } from '../useSyncStatus';
import { BalancesList, HistoryList, MembersList } from './GroupParts';
import { ConnectionBanner } from './ConnectionBanner';
import { ExpenseRow } from './ExpenseRow';
import { PageHeader } from './PageHeader';

const TABS = ['Expenses', 'Balances', 'Members', 'History'] as const;
type Tab = (typeof TABS)[number];

const titleCase = (value: string) => (value ? value[0]!.toUpperCase() + value.slice(1) : value);

const methodTitle = (method: LocalExpense['method']) => (method === 'equal' ? 'Split equally' : method === 'exact' ? 'Split by amount' : 'Split by percent');

export function GroupDesktop({ data }: { data: GroupData }) {
  const router = useRouter();
  const status = useSyncStatus();
  const { group, expenses, summary } = data;
  const [tab, setTab] = useState<Tab>('Expenses');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currency = summary.currencyCode;
  const live = expenses.filter((e) => !e.deletedAt);
  const rows = live.map((e) => expenseRow(e, group)).sort(byNewest);
  const selected = live.find((e) => e.id === (selectedId ?? rows[0]?.id));
  const offline = status !== null && status.connectivity === 'offline';
  const standing = summary.myBalance > 0 ? `You're owed ${formatCurrency(summary.myBalance, currency)}` : summary.myBalance < 0 ? `You owe ${formatCurrency(-summary.myBalance, currency)}` : 'All settled up';
  const subtitle = offline && status?.lastSyncedAt
    ? `Showing saved data from ${new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : `${summary.memberCount} ${summary.memberCount === 1 ? 'member' : 'members'} · ${currency} · ${standing}`;

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={subtitle}
        actions={<Button label="Add expense" size="small" icon={<Icon icon={Plus} size={18} strokeWidth={2.4} tone="on-primary" />} onPress={() => router.push('/add-expense')} />}
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
      {tab === 'Balances' ? <BalancesList data={data} /> : null}
      {tab === 'Members' ? <MembersList data={data} /> : null}
      {tab === 'History' ? <HistoryList data={data} /> : null}
    </>
  );
}

function ExpensePanel({ expense, data }: { expense: LocalExpense; data: GroupData }) {
  const { group, summary } = data;
  const currency = summary.currencyCode;
  const row = expenseRow(expense, group);
  const nameOf = (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? (member.id === group.meMemberID ? 'You' : member.name) : 'Someone';
  };
  const kicker = row.position.kind === 'lent' ? `YOU LENT ${formatCurrency(row.position.minorUnits, currency)}` : row.position.kind === 'owe' ? `YOU OWE ${formatCurrency(row.position.minorUnits, currency)}` : "YOU'RE NOT INVOLVED";
  return (
    <Card className="w-[400px] shrink-0 gap-1 p-[22px]">
      <View className="gap-1 rounded-[18px] bg-primary px-5 py-[18px]" style={{ backgroundColor: '#0B4350' }}>
        <Text variant="label" tone="mint">{kicker}</Text>
        <Text variant="section" tone="white">{expense.merchant}</Text>
        <Text variant="large-title" tone="white" className="text-[34px] leading-10">{formatCurrency(expense.amountMinor, currency)}</Text>
        <Text variant="caption" tone="hero-muted" className="text-[13px]">{group.name} · {titleCase(expense.category)} · {longDate(expense.occurredAt)}</Text>
      </View>
      <Text variant="section" accessibilityRole="header" className="pb-1 pt-4 text-base">{methodTitle(expense.method)}</Text>
      {expense.allocations.map((a, i) => {
        const name = nameOf(a.memberID);
        const paid = a.memberID === expense.payerID;
        const payer = nameOf(expense.payerID);
        const note = paid ? `Paid ${formatCurrency(expense.amountMinor, currency)}` : payer === 'You' ? `Owes you ${formatCurrency(a.minorUnits, currency)}` : name === 'You' ? `You owe ${payer}` : `Owes ${payer}`;
        const realName = group.members.find((m) => m.id === a.memberID)?.name ?? name;
        return (
          <View key={a.memberID} accessible accessibilityLabel={`${name}, ${note}, share ${formatCurrency(a.minorUnits, currency)}`} className={`flex-row items-center gap-3 py-3 ${i < expense.allocations.length - 1 ? 'border-b border-divider' : ''}`}>
            <Avatar name={realName} id={a.memberID} />
            <View className="flex-1">
              <Text variant="body-small" className="text-sm font-semibold">{name}</Text>
              <Text variant="caption" tone="muted">{note}</Text>
            </View>
            <Text variant="body-small" className="text-sm font-bold">{formatCurrency(a.minorUnits, currency)}</Text>
          </View>
        );
      })}
      {expense.history.length > 0 ? (
        <>
          <Text variant="section" accessibilityRole="header" className="pb-1 pt-4 text-base">History</Text>
          {expense.history.map((h, i) => (
            <Text key={i} variant="caption" tone="muted" className="text-[13px] leading-6">
              {h.reason === 'edited_elsewhere' ? 'Edited by someone else' : h.reason === 'you_chose_theirs' ? 'You kept the other version' : 'You replaced the other version'} · {longDate(h.at)}
            </Text>
          ))}
        </>
      ) : null}
    </Card>
  );
}
