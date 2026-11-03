import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { cx } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface CheckRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  detail?: string;
  divider?: boolean;
  className?: string;
}

export function CheckRow({ label, checked, onToggle, trailing, detail, divider, className }: CheckRowProps) {
  return (
    <View className={cx('min-h-row flex-row items-center gap-3 px-4', divider && 'border-b border-divider', className)}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={onToggle}
        hitSlop={6}
        className="min-h-touch min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
      >
        <View className={cx('h-6 w-6 items-center justify-center rounded-md border-2', checked ? 'border-primary bg-primary' : 'border-field-border bg-card')}>
          {checked ? <Icon icon={Check} size={16} strokeWidth={3} tone="on-primary" /> : null}
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="body" className="font-semibold" numberOfLines={1}>{label}</Text>
          {detail ? <Text variant="caption" tone="muted" className="text-[13px]">{detail}</Text> : null}
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}
