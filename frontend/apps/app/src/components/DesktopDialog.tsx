import { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, FieldLayoutProvider, Text } from '@commontab/ui';

export function DesktopDialog({ title, headerRight, children, onClose, secondaryLabel = 'Cancel', primary, width = 600 }: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  secondaryLabel?: string;
  primary?: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  width?: number;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center px-6 py-6" style={{ backgroundColor: 'rgba(14,26,28,0.5)' }}>
      <Pressable accessible={false} accessibilityElementsHidden importantForAccessibility="no" onPress={onClose} className="absolute inset-0" />
      <View accessibilityViewIsModal role="dialog" accessibilityLabel={title} className="max-h-full w-full rounded-[28px] bg-background" style={{ maxWidth: width, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' } as never}>
        <View className="flex-row items-center justify-between gap-4 px-7 pb-3 pt-7">
          <Text variant="large-title" accessibilityRole="header" className="text-2xl leading-8">{title}</Text>
          {headerRight}
        </View>
        <ScrollView className="shrink" contentContainerClassName="gap-4 px-7 py-2" keyboardShouldPersistTaps="handled">
          <FieldLayoutProvider layout="stacked">{children}</FieldLayoutProvider>
        </ScrollView>
        <View className="flex-row justify-end gap-2.5 px-7 pb-7 pt-4">
          <Button label={secondaryLabel} variant="secondary" size="small" onPress={onClose} />
          {primary ? <Button label={primary.label} size="small" disabled={primary.disabled} loading={primary.loading} onPress={primary.onPress} /> : null}
        </View>
      </View>
    </View>
  );
}
