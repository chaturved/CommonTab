import { ReactNode } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { cx, useThemeColors } from '../theme';
import { Text } from './Text';

export interface FieldRowProps extends Omit<TextInputProps, 'accessibilityLabel'> {
  label: string;
  last?: boolean;
  className?: string;
}

export function FieldRow({ label, last, className, ...props }: FieldRowProps) {
  const colors = useThemeColors();
  return (
    <View className={cx('min-h-row flex-row items-center gap-3 px-4', last ? '' : 'border-b border-divider', className)}>
      <Text variant="body-small" tone="muted" className="w-[84px]" accessible={false}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        className="min-h-touch flex-1 text-body text-fg"
        style={{ outlineStyle: 'none' } as never}
        {...props}
      />
    </View>
  );
}

export function FieldGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cx('overflow-hidden rounded-card bg-card', className)}>{children}</View>;
}
