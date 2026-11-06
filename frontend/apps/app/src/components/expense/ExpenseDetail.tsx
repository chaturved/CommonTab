import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { categoryLabel, expenseChanges, expenseHistory, expenseRow, formatCurrency, longDate, rateSentence, type LocalExpense } from '@commontab/core';
import { Avatar, Banner, Button, Hero, Sheet, Text } from '@commontab/ui';
import { useApp } from '@/context/AppContext';
import { useActivityEvents } from '@/hooks/useActivityEvents';
import type { GroupData } from '@/types/group';

const methodTitle = (method: LocalExpense['method']) => (method === 'equal' ? 'Split equally' : method === 'exact' ? 'Split by amount' : 'Split by percent');

function useNames(data: GroupData) {
  const { group } = data;
  return (id: string) => {
    const member = group.members.find((m) => m.id === id);
    return member ? (member.id === group.meMemberID ? 'You' : member.name) : 'Someone';
  };
}

export function ExpenseBody({ expense, data }: { expense: LocalExpense; data: GroupData }) {
  const { group, summary } = data;
  const currency = summary.currencyCode;
  const row = expenseRow(expense, group);
  const nameOf = useNames(data);
  const { events } = useActivityEvents();
  const lines = expenseHistory(events, expense.id, group);
  const original = expense.currencyCode && expense.originalMinor && expense.rateMicros
    ? `${formatCurrency(expense.originalMinor, expense.currencyCode)} at ${rateSentence(expense.currencyCode, currency, expense.rateMicros)}`
    : null;
  const kicker = row.position.kind === 'lent' ? `YOU LENT ${formatCurrency(row.position.minorUnits, currency)}` : row.position.kind === 'owe' ? `YOU OWE ${formatCurrency(row.position.minorUnits, currency)}` : "YOU'RE NOT INVOLVED";
  return (
    <View className="gap-1">
      <Hero accessible accessibilityLabel={`${kicker.toLowerCase()}. ${expense.merchant}, ${formatCurrency(expense.amountMinor, currency)}${original ? `, from ${original}` : ''}. ${group.name}, ${categoryLabel(expense.category)}, ${longDate(expense.occurredAt)}`} padding={20}>
        <View className="gap-1" importantForAccessibility="no-hide-descendants">
          <Text variant="label" tone="mint">{kicker}</Text>
          <Text variant="section" tone="white">{expense.merchant}</Text>
          <Text variant="large-title" tone="white" className="text-[34px] leading-10">{formatCurrency(expense.amountMinor, currency)}</Text>
          {original ? <Text variant="caption" tone="hero-muted" className="text-[13px]">{original}</Text> : null}
          <Text variant="caption" tone="hero-muted" className="text-[13px]">{group.name} · {categoryLabel(expense.category)} · {longDate(expense.occurredAt)}</Text>
        </View>
      </Hero>
      {expense.notes ? <Text variant="body-small" tone="fg-soft" className="px-1 pt-3 leading-[22px]">{expense.notes}</Text> : null}
      <Text variant="section" accessibilityRole="header" className="pb-1 pt-4 text-base">{methodTitle(expense.method)}</Text>
      {expense.allocations.map((a, i) => {
        const name = nameOf(a.memberID);
        const payer = nameOf(expense.payerID);
        const paid = a.memberID === expense.payerID;
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
      {expense.history.length > 0 || lines.length > 0 ? (
        <>
          <Text variant="section" accessibilityRole="header" className="pb-1 pt-4 text-base">History</Text>
          {lines.map((l) => (
            <Text key={l.seq} variant="caption" tone="muted" className="text-[13px] leading-6">{l.text} · {l.when}</Text>
          ))}
          {expense.history.map((h, i) => (
            <Text key={i} variant="caption" tone="muted" className="text-[13px] leading-6">
              {h.reason === 'edited_elsewhere' ? 'Edited by someone else' : h.reason === 'you_chose_theirs' ? 'You kept the other version' : 'You replaced the other version'} · {longDate(h.at)}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

export function ExpenseStatus({ expense, data }: { expense: LocalExpense; data: GroupData }) {
  const router = useRouter();
  const { services } = useApp();
  const [failedOpId, setFailedOpId] = useState<string | null>(null);

  useEffect(() => {
    if (expense.syncState !== 'failed') {
      setFailedOpId(null);
      return;
    }
    void services.storage.listOutbox().then((entries) => setFailedOpId(entries.find((e) => e.entityId === expense.id && e.status === 'failed')?.opId ?? null));
  }, [services, expense.id, expense.syncState]);

  if (expense.syncState === 'pending') return <Banner tone="info" message="Saved here. Waiting to sync." />;

  if (expense.syncState === 'failed') {
    return (
      <View className="gap-2">
        <Banner tone="error" title="This change couldn't sync." message={expense.error?.message ?? 'The server turned it down.'} />
        <Button label="Edit the expense" variant="secondary" onPress={() => router.push({ pathname: '/expense/[id]/edit', params: { id: expense.id } })} />
        <Button label="Discard this change" variant="ghost" disabled={!failedOpId} onPress={() => failedOpId && void services.actions.discardFailed(failedOpId)} />
      </View>
    );
  }

  if (expense.syncState === 'conflict' && expense.conflict) {
    const changes = expenseChanges(expense.conflict.mine, expense, data.group);
    return (
      <View className="gap-2.5">
        <Banner tone="warning" title="Someone else edited this too." message="Your change wasn't saved because theirs was newer. Pick the version to keep." />
        {changes.length > 0 ? (
          <View className="gap-2 rounded-card bg-card p-4">
            <Text variant="label" tone="muted">What changed</Text>
            {changes.map((c) => (
              <View key={c.field} accessible accessibilityLabel={`${c.label}. Your edit: ${c.mine}. Their edit: ${c.theirs}.`} className="gap-0.5 border-b border-divider pb-2">
                <Text variant="caption" tone="muted">{c.label}</Text>
                <Text variant="body-small"><Text variant="body-small" tone="muted">Yours: </Text>{c.mine}</Text>
                <Text variant="body-small" className="font-semibold"><Text variant="body-small" tone="muted" className="font-normal">Kept: </Text>{c.theirs}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Button label="Keep theirs" onPress={() => void services.actions.resolveConflict(expense.id, 'theirs')} />
        <Button label="Keep mine" variant="secondary" onPress={() => void services.actions.resolveConflict(expense.id, 'mine')} />
      </View>
    );
  }
  return null;
}

export function ExpenseActions({ expense, data, afterDelete }: { expense: LocalExpense; data: GroupData; afterDelete?: () => void }) {
  const router = useRouter();
  const { services } = useApp();
  const [confirming, setConfirming] = useState(false);
  const { group } = data;
  const canEdit = expense.syncState !== 'conflict';

  const remove = async () => {
    setConfirming(false);
    await services.actions.deleteExpense(expense.id);
    void services.engine.sync();
    afterDelete?.();
  };

  return (
    <>
      <View className="flex-row gap-2.5 pt-4">
        {canEdit ? <Button label="Edit" className="flex-1" onPress={() => router.push({ pathname: '/expense/[id]/edit', params: { id: expense.id } })} /> : null}
        <Button label="Delete" variant="secondary" className="flex-1" onPress={() => setConfirming(true)} />
      </View>
      <Text variant="caption" tone="muted" className="pt-2 text-center text-[13px]">Deleting updates balances for everyone in the group.</Text>
      <Sheet visible={confirming} onClose={() => setConfirming(false)} title={`Delete "${expense.merchant}"?`}>
        <Text variant="body-small" tone="fg-soft" className="leading-[22px]">
          Balances in {group.name} will update. Everyone will see it was deleted, and you can find it in the group history.
        </Text>
        <Button label="Delete expense" onPress={remove} />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirming(false)} />
      </Sheet>
    </>
  );
}

export function ExpenseDetailContent({ expense, data, afterDelete }: { expense: LocalExpense; data: GroupData; afterDelete?: () => void }) {
  return (
    <View className="gap-3">
      <ExpenseStatus expense={expense} data={data} />
      <ExpenseBody expense={expense} data={data} />
      <ExpenseActions expense={expense} data={data} afterDelete={afterDelete} />
    </View>
  );
}
