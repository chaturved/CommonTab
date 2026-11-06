import { ReactNode } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import type { AnchorBox } from '@/hooks/useWindowAnchor';

const EDGE = 12;
const GAP = 6;
const MAX_HEIGHT = 360;

interface Props {
  visible: boolean;
  onClose: () => void;
  anchor: AnchorBox | null;
  label: string;
  width: number;
  align?: 'start' | 'end';
  children: ReactNode;
}

export function Popover({ visible, onClose, anchor, label, width, align = 'start', children }: Props) {
  const window = useWindowDimensions();
  const left = anchor ? (align === 'end' ? anchor.x + anchor.w - width : anchor.x) : 0;
  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      <Pressable accessible={false} onPress={onClose} className="absolute inset-0" />
      {anchor ? (
        <View
          role="dialog"
          accessibilityLabel={label}
          className="absolute overflow-hidden rounded-2xl border border-divider bg-card"
          style={{ left: Math.max(EDGE, Math.min(left, window.width - width - EDGE)), top: Math.min(anchor.y + anchor.h + GAP, Math.max(EDGE, window.height - MAX_HEIGHT - EDGE)), width, maxHeight: MAX_HEIGHT, boxShadow: '0 16px 48px rgba(0,0,0,0.22)' } as never}
        >
          {children}
        </View>
      ) : null}
    </Modal>
  );
}
