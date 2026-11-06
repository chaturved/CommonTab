import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';
import { formatCurrency } from '@commontab/core';
import { BackButton, Text } from '@commontab/ui';
import { ExpenseActionBar } from '@/components/expense/ExpenseActionBar';
import { SplitEditor } from '@/components/expense/SplitEditor';
import { Screen } from '@/components/layout/Screen';
import { useIsDesktop } from '@/hooks/useViewport';
import { splitMethodLabel } from '@/lib/splitSummary';
import { setSplitByItem, useExpenseDraft } from '@/state/expenseDraft';

const TITLES = { equal: 'Split equally', exact: 'Split exactly', percent: 'Split by percent' } as const;

export default function SplitPage() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { draft, byItem } = useExpenseDraft();
  if (!draft) return <Redirect href="/add-expense" />;

  const { form, evaluated, group } = draft;
  const currency = group.currencyCode;
  const title = byItem ? 'Split by item' : TITLES[form.method];
  const total = evaluated.amountMinor !== null ? formatCurrency(evaluated.amountMinor, currency) : formatCurrency(0, currency);
  const ready = Boolean(evaluated.draft);
  const summary = ready ? `${splitMethodLabel(form, byItem)} · ${total}` : 'Fix the split to continue.';

  return (
    <Screen wide footer={<ExpenseActionBar desktop={desktop} label="Done" cancelLabel="Back" summary={summary} ready={ready} busy={false} onCancel={() => router.back()} onSave={() => router.back()} />}>
      <View className="w-full max-w-[560px] gap-4 self-start">
        <View className={desktop ? 'min-h-touch flex-row items-center gap-3' : 'min-h-touch flex-row items-center justify-between'}>
          <BackButton onPress={() => router.back()} />
          <Text variant={desktop ? 'large-title' : 'screen-title'} accessibilityRole="header" className={desktop ? 'text-2xl leading-8' : undefined}>{title}</Text>
          {desktop ? null : <View className="w-11" />}
        </View>
        <View className="flex-row items-center justify-between rounded-card bg-card px-4 py-3">
          <Text variant="body-small" tone="muted">Expense total</Text>
          <Text variant="section" accessibilityLabel={`Expense total ${total}`}>{total}</Text>
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
          onPickItems={() => router.push('/split-by-item')}
          onLeaveItems={() => setSplitByItem(false)}
        />
      </View>
    </Screen>
  );
}
