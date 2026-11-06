import { useCallback, useState } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { applyItemized, displayName, formatCurrency, isDefaultSplit, resetSplit, type ItemizedResult } from '@commontab/core';
import { BackButton, Button, Text } from '@commontab/ui';
import { ExpenseActionBar } from '@/components/expense/ExpenseActionBar';
import { ItemizedEditor } from '@/components/expense/ItemizedEditor';
import { SplitEditor } from '@/components/expense/SplitEditor';
import { Screen } from '@/components/layout/Screen';
import { useIsDesktop } from '@/hooks/useViewport';
import { splitMethodLabel } from '@/lib/splitSummary';
import { setSplitByItem, useExpenseDraft } from '@/state/expenseDraft';
import { resetItemizedSplit, useItemizedSplitDraft } from '@/state/itemizedSplit';

const TITLES = { equal: 'Split equally', exact: 'Split exactly', percent: 'Split by percent' } as const;

export function SplitScreen({ fallback }: { fallback: Href }) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { draft, byItem } = useExpenseDraft();
  const [items, setItems] = useItemizedSplitDraft();
  const [itemResult, setItemResult] = useState<ItemizedResult | null>(null);
  const setForm = draft?.setForm;
  const currency = draft?.group.currencyCode ?? 'USD';
  const applyResult = useCallback((result: ItemizedResult | null) => {
    setItemResult(result);
    if (result && setForm) setForm((f) => applyItemized(f, result, currency));
  }, [setForm, currency]);
  if (!draft) return <Redirect href={fallback} />;

  const { form, evaluated, group } = draft;
  const title = byItem ? 'Split by item' : TITLES[form.method];
  const total = evaluated.amountMinor !== null ? formatCurrency(evaluated.amountMinor, currency) : formatCurrency(0, currency);
  const issue = form.method !== 'equal' && !byItem ? evaluated.split : null;
  const blocker = evaluated.amountMinor === null
    ? 'Enter an amount on the expense first.'
    : evaluated.errors.participants ?? (issue ? 'Fix the split to continue.' : byItem && itemResult === null ? 'Add an item, a price and who had it.' : null);
  const ready = blocker === null;
  const hasItems = items.items.some((item) => item.name !== '' || item.priceText !== '');
  const resettable = byItem ? hasItems : !isDefaultSplit(form, group);
  const resetLabel = byItem ? 'Clear items' : form.method === 'equal' ? 'Include everyone' : 'Reset to equal split';
  const reset = () => (byItem ? resetItemizedSplit() : draft.setForm((f) => resetSplit(f, group)));
  const summary = blocker ?? `${splitMethodLabel(form, byItem)} · ${total}`;

  const actions = <ExpenseActionBar desktop={desktop} label="Done" summary={summary} ready={ready} busy={false} pinned={!desktop} onSave={() => router.back()} />;

  return (
    <Screen wide footer={desktop ? undefined : actions}>
      <View className="w-full max-w-[960px] gap-4 self-start">
        <View className={desktop ? 'min-h-touch flex-row items-center gap-3' : 'min-h-touch flex-row items-center justify-between'}>
          <BackButton onPress={() => router.back()} />
          <Text variant={desktop ? 'large-title' : 'screen-title'} accessibilityRole="header" className={desktop ? 'text-2xl leading-8' : undefined}>{title}</Text>
          {desktop ? null : <View className="w-11" />}
        </View>
        <View className="flex-row items-center justify-between gap-3 rounded-card bg-card px-4 py-3">
          <Text variant="body-small" tone="muted">Expense total</Text>
          <View className="items-end">
            <Text variant="section" accessibilityLabel={`Expense total ${total}`}>{total}</Text>
            {byItem && itemResult ? (
              <Text variant="caption" tone="muted" className="text-[13px]">
                Items {formatCurrency(itemResult.subtotal, currency)} · Tax and tip {formatCurrency(itemResult.tax + itemResult.tip, currency)}
              </Text>
            ) : null}
          </View>
        </View>
        <SplitEditor
          form={form}
          setForm={draft.setForm}
          patch={draft.patch}
          evaluated={evaluated}
          people={draft.people}
          memberIds={draft.memberIds}
          group={group}
          desktop={desktop}
          note={draft.note}
          byItem={byItem}
          belowSelector={resettable ? <Button label={resetLabel} variant="ghost" size="small" onPress={reset} /> : null}
          onByItem={setSplitByItem}
          itemized={<ItemizedEditor people={draft.people.map((m) => ({ id: m.id, name: displayName(m, group.meMemberID) }))} currencyCode={currency} draft={items} onDraft={setItems} onResult={applyResult} hideTotal />}
        />
        {desktop ? actions : null}
      </View>
    </Screen>
  );
}
