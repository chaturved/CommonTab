import { View } from 'react-native';
import { Clock, Receipt } from 'lucide-react-native';
import { formatCurrency, type ExpenseRowModel } from '@commontab/core';
import { Icon, Text } from '@commontab/ui';

export function ExpenseRow({ row, currencyCode, subtitle, divider }: { row: ExpenseRowModel; currencyCode: string; subtitle: 'group' | 'home'; divider?: boolean }) {
  const amount = formatCurrency(row.position.kind === 'none' ? 0 : row.position.minorUnits, currencyCode);
  const text = subtitle === 'group' ? row.groupSubtitle : row.homeSubtitle;
  const label = `${row.merchant}, ${text}, ${row.position.kind === 'none' ? 'you are not involved' : `${row.words} ${amount}`}${row.pendingLabel ? `, ${row.pendingLabel}` : ''}`;
  return (
    <View accessible accessibilityLabel={label} className={`min-h-row flex-row items-center gap-3.5 px-4 py-2.5 ${divider ? 'border-b border-divider' : ''}`}>
      {subtitle === 'home' ? (
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-tint">
          <Icon icon={Receipt} size={20} strokeWidth={1.9} tone="on-tint" />
        </View>
      ) : null}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="body" className="font-semibold" numberOfLines={1}>{row.merchant}</Text>
        {row.pendingLabel ? (
          <View className="flex-row items-center gap-1">
            <Icon icon={Clock} size={13} strokeWidth={2.4} tone="warn-icon" />
            <Text variant="caption" tone="on-warn" className="text-[13px]">{row.pendingLabel}</Text>
          </View>
        ) : (
          <Text variant="caption" tone="muted" className="text-[13px]" numberOfLines={1}>{text}</Text>
        )}
      </View>
      <View className="items-end gap-0.5">
        <Text variant="button" tone={row.position.kind === 'owe' ? 'owe' : row.position.kind === 'lent' ? 'accent' : 'muted'}>{amount}</Text>
        <Text variant="caption" tone="muted">{row.words}</Text>
      </View>
    </View>
  );
}
