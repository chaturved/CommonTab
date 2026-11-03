import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { cx } from '../theme';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Sheet({ visible, onClose, title, children, className }: SheetProps) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 768;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className={cx('flex-1 items-center', wide ? 'justify-center px-6' : 'justify-end')}>
        <Pressable testID="sheet-scrim" accessible={false} onPress={onClose} className="absolute inset-0 bg-scrim" />
        <View accessibilityViewIsModal onAccessibilityEscape={onClose} accessibilityLabel={title} className={cx('w-full bg-card pt-3', wide ? 'max-w-[560px] rounded-hero' : 'rounded-t-hero', className)} style={{ maxHeight: height - (wide ? 48 : 24) }}>
          <View className="h-1 w-10 self-center rounded-pill bg-divider" />
          <Text variant="screen-title" accessibilityRole="header" className="px-5 pb-3 pt-4">
            {title}
          </Text>
          <ScrollView className="shrink" contentContainerClassName="gap-4 px-5 pb-8" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
