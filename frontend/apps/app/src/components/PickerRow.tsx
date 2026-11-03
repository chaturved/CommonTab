import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Icon, Text, useFieldLayout, useThemeColors } from '@commontab/ui';

export function PickerRow({ label, value, onPress, last }: { label: string; value: string; onPress?: () => void; last?: boolean }) {
  const colors = useThemeColors();
  const stacked = useFieldLayout() === 'stacked';
  if (stacked) {
    return (
      <View className="gap-1.5">
        <Text variant="caption" tone="muted" className="text-[13px] font-bold" accessible={false}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress} disabled={!onPress} className="min-h-[44px] flex-row items-center justify-between gap-2 rounded-input border bg-card px-3.5 active:opacity-80" style={{ borderColor: colors['field-border'] }}>
          <Text variant="body" numberOfLines={1} className="min-w-0 flex-1">{value}</Text>
          {onPress ? <Icon icon={ChevronRight} size={16} strokeWidth={2.2} tone="muted" /> : null}
        </Pressable>
      </View>
    );
  }
  const body = (
    <>
      <Text variant="body-small" tone="muted" className="w-[84px] shrink-0">{label}</Text>
      <Text variant="body" className="flex-1">{value}</Text>
      {onPress ? <Icon icon={ChevronRight} size={16} strokeWidth={2.2} tone="muted" /> : null}
    </>
  );
  const box = `min-h-row flex-row items-center gap-3 px-4 ${last ? '' : 'border-b border-divider'}`;
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress} className={`${box} active:opacity-80`}>{body}</Pressable>
  ) : (
    <View accessible accessibilityLabel={`${label}, ${value}`} className={box}>{body}</View>
  );
}
