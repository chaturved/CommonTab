import { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@commontab/ui';

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="min-h-touch flex-row items-center justify-between px-1 pt-2">
      <Text variant="section" accessibilityRole="header">{title}</Text>
      {action}
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return <Text variant="label" tone="muted" className="px-2 pt-2">{children}</Text>;
}
