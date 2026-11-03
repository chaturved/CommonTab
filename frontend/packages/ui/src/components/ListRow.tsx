import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { cx, useThemeColors } from '../theme';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Show a chevron for rows that open something. Defaults to true when `onPress` is set and there is no `trailing`. */
  chevron?: boolean;
  /** Thin line under the row, for rows inside one Card. */
  divider?: boolean;
  /** Taller rows (72) for group lists. */
  tall?: boolean;
  /** Defaults to "title, subtitle". Include any money in words here when `trailing` is an amount. */
  accessibilityLabel?: string;
  className?: string;
}

/** Row with a minimum height, so large text makes it grow instead of clipping. */
export function ListRow({ title, subtitle, leading, trailing, onPress, chevron, divider, tall, accessibilityLabel, className }: ListRowProps) {
  const colors = useThemeColors();
  const showChevron = chevron ?? (Boolean(onPress) && !trailing);
  const body = (
    <>
      {leading}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="body" className="font-semibold" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" className="text-[13px]">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <ChevronRight size={16} color={colors.muted} strokeWidth={2.2} /> : null}
    </>
  );
  const box = cx('flex-row items-center gap-3.5 px-4 py-2', tall ? 'min-h-row-tall' : 'min-h-row', divider && 'border-b border-divider', className);
  const label = accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title);
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} className={box}>
        {body}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={cx(box, 'active:opacity-80')}>
      {body}
    </Pressable>
  );
}
