import { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { cx } from '../theme';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Bottom sheet (e.g. SessionExpired, delete confirmation). Closes by tapping the scrim, the Android
 * back gesture, or the VoiceOver escape gesture. The sheet is a modal view, so screen readers skip the
 * scrim; put a labeled button inside for any action the user must be able to take.
 */
export function Sheet({ visible, onClose, title, children, className }: SheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end">
        <Pressable testID="sheet-scrim" accessible={false} onPress={onClose} className="absolute inset-0 bg-scrim" />
        <View accessibilityViewIsModal onAccessibilityEscape={onClose} accessibilityLabel={title} className={cx('gap-4 rounded-t-hero bg-card px-5 pb-8 pt-3', className)}>
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
