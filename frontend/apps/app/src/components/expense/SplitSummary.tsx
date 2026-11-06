import { View } from 'react-native';
import { displayName, formatCurrency } from '@commontab/core';
import { Avatar, Button, Text } from '@commontab/ui';
import { PickerRow } from '@/components/ui/PickerRow';
import { splitMethodLabel, splitSummary } from '@/lib/splitSummary';
import type { ExpenseDraft } from '@/state/expenseDraft';

interface Props {
  draft: ExpenseDraft;
  byItem: boolean;
  desktop: boolean;
  onEdit: () => void;
}

export function SplitSummaryRow({ draft, byItem, onEdit }: Omit<Props, 'desktop'>) {
  return <PickerRow label="Split" value={splitSummary(draft.form, draft.evaluated, byItem, draft.group.currencyCode)} onPress={onEdit} />;
}

export function SplitSummaryCard({ draft, byItem, onEdit }: Omit<Props, 'desktop'>) {
  const { form, evaluated, group } = draft;
  const currency = group.currencyCode;
  const rows = evaluated.shares.filter((s) => form.participants.includes(s.memberID));
  return (
    <View className="gap-3 rounded-card bg-card p-4" style={{ position: 'sticky', top: 24 } as never}>
      <View className="flex-row items-center justify-between">
        <Text variant="section" accessibilityRole="header">Split</Text>
        <Text variant="body-small" tone="muted">{splitMethodLabel(form, byItem)}</Text>
      </View>
      {rows.length > 0 ? (
        <View className="overflow-hidden rounded-2xl bg-background">
          {rows.map((share, i) => {
            const member = group.members.find((m) => m.id === share.memberID);
            if (!member) return null;
            return (
              <View key={share.memberID} className={`min-h-row flex-row items-center gap-3 px-4 ${i < rows.length - 1 ? 'border-b border-divider' : ''}`}>
                <Avatar name={member.name} id={member.id} />
                <Text variant="body" className="flex-1 font-semibold">{displayName(member, group.meMemberID)}</Text>
                <Text variant="button">{formatCurrency(share.minorUnits, currency)}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text variant="body-small" tone="muted">Enter an amount to see who pays what.</Text>
      )}
      <Button label="Edit split" variant="secondary" size="small" className="self-start" onPress={onEdit} />
    </View>
  );
}
