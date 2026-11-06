import { useCallback, useState } from 'react';
import { applyItemized, formatCurrency, isDefaultSplit, resetSplit, type ItemizedResult } from '@commontab/core';
import { splitMethodLabel } from '@/lib/splitSummary';
import type { ExpenseDraft } from '@/state/expenseDraft';
import { resetItemizedSplit, useItemizedSplitDraft } from '@/state/itemizedSplit';

const TITLES = { equal: 'Split equally', exact: 'Split exactly', percent: 'Split by percent' } as const;

export function useSplitView(draft: ExpenseDraft | null, byItem: boolean) {
  const [items, setItems] = useItemizedSplitDraft();
  const [itemResult, setItemResult] = useState<ItemizedResult | null>(null);
  const setForm = draft?.setForm;
  const currency = draft?.group.currencyCode ?? 'USD';
  const applyResult = useCallback((result: ItemizedResult | null) => {
    setItemResult(result);
    if (result && setForm) setForm((f) => applyItemized(f, result, currency));
  }, [setForm, currency]);
  if (!draft) return null;

  const { form, evaluated, group } = draft;
  const total = formatCurrency(evaluated.amountMinor ?? 0, currency);
  const issue = form.method !== 'equal' && !byItem ? evaluated.split : null;
  const blocker = evaluated.amountMinor === null
    ? 'Enter an amount on the expense first.'
    : evaluated.errors.participants ?? (issue ? 'Fix the split to continue.' : byItem && itemResult === null ? 'Add an item, a price and who had it.' : null);
  const hasItems = items.items.some((item) => item.name !== '' || item.priceText !== '');

  return {
    draft,
    byItem,
    currency,
    items,
    setItems,
    itemResult,
    applyResult,
    total,
    title: byItem ? 'Split by item' : TITLES[form.method],
    ready: blocker === null,
    summary: blocker ?? `${splitMethodLabel(form, byItem)} · ${total}`,
    resettable: byItem ? hasItems : !isDefaultSplit(form, group),
    resetLabel: byItem ? 'Clear items' : form.method === 'equal' ? 'Include everyone' : 'Reset to equal split',
    reset: () => (byItem ? resetItemizedSplit() : draft.setForm((f) => resetSplit(f, group))),
  };
}

export type SplitView = NonNullable<ReturnType<typeof useSplitView>>;
