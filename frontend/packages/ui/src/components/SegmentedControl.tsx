import { Pressable, View } from 'react-native';
import { cx } from '../theme';
import { Text } from './Text';

export interface SegmentedControlProps {
  options: readonly { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <View accessibilityRole="tablist" className={cx('flex-row gap-1 rounded-pill bg-divider p-1', className)}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            className={cx('min-h-touch flex-1 items-center justify-center rounded-pill', selected && 'bg-card')}
          >
            <Text variant="body-small" tone={selected ? 'fg' : 'muted'} className={selected ? 'font-bold' : 'font-semibold'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
