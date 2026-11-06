import { Pressable, View } from 'react-native';
import { displayName, formatCurrency } from '@commontab/core';
import { Avatar, Banner, Text } from '@commontab/ui';
import { PickerRow } from '@/components/ui/PickerRow';
import { splitMethodLabel, splitProblem, splitSummary } from '@/lib/splitSummary';
import type { ExpenseDraft } from '@/state/expenseDraft';

interface Props {
  draft: ExpenseDraft;
  byItem: boolean;
  desktop: boolean;
  onEdit: () => void;
}

export function SplitSummaryRow({ draft, byItem, onEdit }: Omit<Props, 'desktop'>) {
  const problem = splitProblem(draft.form, draft.evaluated, byItem, draft.group.currencyCode);
  return (
    <>
      <PickerRow label="Split" value={splitSummary(draft.form, draft.evaluated, byItem, draft.group.currencyCode)} onPress={onEdit} />
      {problem ? <Text variant="caption" tone="owe" accessibilityRole="alert" className="px-4 pb-3 text-[13px]">{problem}</Text> : null}
    </>
  );
}

const columnsFor = (count: number) => (count <= 3 ? Math.max(1, count) : count === 4 ? 2 : count <= 6 ? 3 : 4);

export function SplitSummaryCard({ draft, byItem, onEdit }: Omit<Props, 'desktop'>) {
  const { form, evaluated, group } = draft;
  const currency = group.currencyCode;
  const rows = evaluated.shares.filter((s) => form.participants.includes(s.memberID));
  const problem = splitProblem(form, evaluated, byItem, currency);
  return (
    <View className="gap-3 rounded-card bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text variant="section" accessibilityRole="header">Split</Text>
        <View className="flex-row items-center gap-3">
          <Text variant="body-small" tone="muted">{splitMethodLabel(form, byItem)}</Text>
          <Pressable accessibilityRole="link" accessibilityLabel="Edit split" onPress={onEdit} className="min-h-touch justify-center active:opacity-80">
            <Text variant="body-small" tone="accent" className="font-bold">Edit split</Text>
          </Pressable>
        </View>
      </View>
      {problem ? (
        <Banner tone="error" message={problem} />
      ) : rows.length > 0 ? (
        <View style={{ display: 'grid', gridTemplateColumns: `repeat(${columnsFor(rows.length)}, minmax(0, 1fr))`, gap: 12 } as never}>
          {rows.map((share) => {
            const member = group.members.find((m) => m.id === share.memberID);
            if (!member) return null;
            return (
              <View key={share.memberID} className="min-h-row flex-row items-center gap-3 rounded-2xl bg-background px-4">
                <Avatar name={member.name} id={member.id} />
                <Text variant="body" className="flex-1 font-semibold">{displayName(member, group.meMemberID)}</Text>
                <Text variant="button">{formatCurrency(share.minorUnits, currency)}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text variant="body-small" tone="muted">{evaluated.amountMinor === null ? 'Enter an amount to see who pays what.' : 'Pick who shares this expense.'}</Text>
      )}
    </View>
  );
}
