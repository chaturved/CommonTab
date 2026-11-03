import { ReactNode } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
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
  const wide = useWindowDimensions().width >= 768;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className={cx('flex-1 items-center', wide ? 'justify-center px-6' : 'justify-end')}>
        <Pressable testID="sheet-scrim" accessible={false} onPress={onClose} className="absolute inset-0 bg-scrim" />
        <View accessibilityViewIsModal onAccessibilityEscape={onClose} accessibilityLabel={title} className={cx('w-full gap-4 bg-card px-5 pb-8 pt-3', wide ? 'max-w-[560px] rounded-hero' : 'rounded-t-hero', className)}>
          <View className="h-1 w-10 self-center rounded-pill bg-divider" />
          <Text variant="screen-title" accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}
