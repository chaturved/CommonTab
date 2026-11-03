import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { cx } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
  tall?: boolean;
  accessibilityLabel?: string;
  className?: string;
}

export function ListRow({ title, subtitle, leading, trailing, onPress, chevron, divider, tall, accessibilityLabel, className }: ListRowProps) {
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
      {showChevron ? <Icon icon={ChevronRight} size={16} strokeWidth={2.2} tone="muted" /> : null}
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
