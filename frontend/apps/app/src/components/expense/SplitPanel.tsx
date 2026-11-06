import { View } from 'react-native';
import { displayName, formatCurrency } from '@commontab/core';
import { Button, Text } from '@commontab/ui';
import { ItemizedEditor } from '@/components/expense/ItemizedEditor';
import { SplitEditor } from '@/components/expense/SplitEditor';
import type { SplitView } from '@/hooks/useSplitView';
import { setSplitByItem } from '@/state/expenseDraft';

export function SplitPanel({ view, desktop }: { view: SplitView; desktop: boolean }) {
  const { draft, byItem, currency, total, itemResult } = view;
  const { form, evaluated, group } = draft;
  return (
    <>
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
        belowSelector={view.resettable ? <Button label={view.resetLabel} variant="ghost" size="small" onPress={view.reset} /> : null}
        onByItem={setSplitByItem}
        itemized={<ItemizedEditor people={draft.people.map((m) => ({ id: m.id, name: displayName(m, group.meMemberID) }))} currencyCode={currency} draft={view.items} onDraft={view.setItems} onResult={view.applyResult} hideTotal />}
      />
    </>
  );
}
