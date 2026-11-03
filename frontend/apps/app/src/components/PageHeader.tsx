import { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@commontab/ui';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <View className="flex-row items-end justify-between gap-4">
      <View className="min-w-0 flex-1">
        <Text variant="large-title" accessibilityRole="header" numberOfLines={1} className="text-[32px] leading-[38px]">{title}</Text>
        {subtitle ? <Text variant="body-small" tone="muted" className="mt-1 text-sm">{subtitle}</Text> : null}
      </View>
      {actions ? <View className="flex-row gap-2.5">{actions}</View> : null}
    </View>
  );
}
