import { ReactNode, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { BackButton, Button, FieldLayoutProvider, Icon, Text, useThemeColors } from '@commontab/ui';

export function DesktopDialog({ title, headerRight, children, onClose, onBack, footer, secondaryLabel = 'Cancel', primary, width = 600 }: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  footer?: ReactNode;
  secondaryLabel?: string;
  primary?: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  width?: number;
}) {
  const colors = useThemeColors();
  const [view, setView] = useState({ height: 0, content: 0, offset: 0 });
  const more = view.content - view.height - view.offset > 4;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <View className="absolute inset-0 items-center justify-center px-6 py-6" style={{ backgroundColor: 'rgba(14,26,28,0.5)' }}>
      <Pressable accessible={false} accessibilityElementsHidden importantForAccessibility="no" onPress={onClose} className="absolute inset-0" />
      <View accessibilityViewIsModal role="dialog" accessibilityLabel={title} className="max-h-full w-full rounded-[28px] bg-background" style={{ maxWidth: width, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' } as never}>
        <View className="flex-row items-center justify-between gap-4 px-7 pb-3 pt-7">
          <View className="min-w-0 flex-1 flex-row items-center gap-3">
            {onBack ? <BackButton onPress={onBack} /> : null}
            <Text variant="large-title" accessibilityRole="header" className="text-2xl leading-8">{title}</Text>
          </View>
          <View className="flex-row items-center gap-3">
            {headerRight}
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-pill active:opacity-80">
              <Icon icon={X} size={22} strokeWidth={2} tone="muted" />
            </Pressable>
          </View>
        </View>
        <View className="shrink">
          <ScrollView
            className="shrink"
            contentContainerClassName="gap-4 px-7 py-2"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onLayout={(e) => setView((v) => ({ ...v, height: e.nativeEvent.layout.height }))}
            onContentSizeChange={(_, content) => setView((v) => ({ ...v, content }))}
            onScroll={(e) => setView((v) => ({ ...v, offset: e.nativeEvent.contentOffset.y }))}
          >
            <FieldLayoutProvider layout="stacked">{children}</FieldLayoutProvider>
          </ScrollView>
          {more ? <LinearGradient pointerEvents="none" colors={['transparent', colors.background]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 }} /> : null}
        </View>
        <View className="flex-row justify-end gap-2.5 px-7 pb-7 pt-4">
          {footer ?? (
            <>
              <Button label={secondaryLabel} variant="secondary" size="small" onPress={onClose} />
              {primary ? <Button label={primary.label} size="small" disabled={primary.disabled} loading={primary.loading} onPress={primary.onPress} /> : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}
