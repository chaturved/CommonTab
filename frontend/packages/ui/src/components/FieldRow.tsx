import { createContext, ReactNode, useContext, useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { cx, useThemeColors } from '../theme';
import { Text } from './Text';

export type FieldLayout = 'row' | 'stacked' | 'pill';

const FieldLayoutContext = createContext<FieldLayout>('row');

export function useFieldLayout(): FieldLayout {
  return useContext(FieldLayoutContext);
}

export function FieldLayoutProvider({ layout, children }: { layout: FieldLayout; children: ReactNode }) {
  return <FieldLayoutContext.Provider value={layout}>{children}</FieldLayoutContext.Provider>;
}

export interface FieldRowProps extends Omit<TextInputProps, 'accessibilityLabel'> {
  label: string;
  last?: boolean;
  className?: string;
}

export function FieldRow({ label, last, className, ...props }: FieldRowProps) {
  const colors = useThemeColors();
  const layout = useContext(FieldLayoutContext);
  const [focused, setFocused] = useState(false);
  if (layout === 'pill') {
    const { onFocus, onBlur, ...rest } = props;
    return (
      <View className="gap-2">
        <Text variant="body-small" tone="fg" className="text-sm font-semibold" accessible={false}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          className={cx('h-14 rounded-pill border bg-card px-[22px] text-[17px] text-fg', focused ? 'border-accent' : 'border-divider')}
          style={{ outlineStyle: 'none', boxShadow: focused ? `0 0 0 2px ${colors.accent}` : 'none' } as never}
          {...rest}
        />
      </View>
    );
  }
  if (layout === 'stacked') {
    return (
      <View className="gap-1.5">
        <Text variant="caption" tone="muted" className="text-[13px] font-bold" accessible={false}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          className="h-12 rounded-input border bg-card px-4 text-[16px] text-fg"
          style={{ borderColor: colors['field-border'], outlineStyle: 'none' } as never}
          {...props}
        />
      </View>
    );
  }
  return (
    <View className={cx('min-h-row flex-row items-center gap-3 px-4', last ? '' : 'border-b border-divider', className)}>
      <Text variant="body-small" tone="muted" className="w-[84px] shrink-0" accessible={false}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        className="min-h-touch min-w-0 flex-1 text-body text-fg"
        style={{ outlineStyle: 'none' } as never}
        {...props}
      />
    </View>
  );
}

export function FieldGroup({ children, className }: { children: ReactNode; className?: string }) {
  const layout = useContext(FieldLayoutContext);
  return <View className={cx(layout === 'stacked' || layout === 'pill' ? 'gap-4' : 'overflow-hidden rounded-card bg-card', className)}>{children}</View>;
}
