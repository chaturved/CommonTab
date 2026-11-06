import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';
import { applyItemized, displayName, formatCurrency, type ItemizedResult } from '@commontab/core';
import { BackButton, Text } from '@commontab/ui';
import { ExpenseActionBar } from '@/components/expense/ExpenseActionBar';
import { ItemizedEditor } from '@/components/expense/ItemizedEditor';
import { Screen } from '@/components/layout/Screen';
import { useIsDesktop } from '@/hooks/useViewport';
import { setSplitByItem, useExpenseDraft } from '@/state/expenseDraft';
import { useItemizedSplitDraft } from '@/state/itemizedSplit';

export default function SplitByItem() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { draft: expense } = useExpenseDraft();
  const [items, setItems] = useItemizedSplitDraft();
  const [result, setResult] = useState<ItemizedResult | null>(null);
  if (!expense) return <Redirect href="/add-expense" />;

  const { group } = expense;
  const currency = group.currencyCode;
  const people = expense.people.map((m) => ({ id: m.id, name: displayName(m, group.meMemberID) }));
  const apply = () => {
    if (!result) return;
    expense.setForm((f) => applyItemized(f, result, currency));
    setSplitByItem(true);
    router.back();
  };
  const payers = result ? result.shares.filter((s) => s.total > 0).length : 0;
  const summary = result
    ? `${formatCurrency(result.total, currency)} ${payers === 1 ? 'for 1 person' : `split between ${payers} people`}`
    : 'Add an item, a price and who had it.';

  const header = desktop ? (
    <View className="min-h-touch flex-row items-center gap-3">
      <BackButton onPress={() => router.back()} />
      <Text variant="large-title" accessibilityRole="header" className="text-2xl leading-8">Split by item</Text>
    </View>
  ) : (
    <View className="min-h-touch flex-row items-center justify-between">
      <BackButton onPress={() => router.back()} />
      <Text variant="screen-title" accessibilityRole="header">Split by item</Text>
      <View className="w-11" />
    </View>
  );

  return (
    <Screen wide footer={<ExpenseActionBar desktop={desktop} label="Use this split" summary={summary} ready={result !== null} busy={false} onCancel={() => router.back()} onSave={apply} />}>
      <View className="w-full max-w-[560px] gap-4 self-start">
        {header}
        <ItemizedEditor people={people} currencyCode={currency} draft={items} onDraft={setItems} onResult={setResult} />
      </View>
    </Screen>
  );
}
