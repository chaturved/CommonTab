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
  maxHeight?: number;
  children: ReactNode;
}

export function Popover({ visible, onClose, anchor, label, width, align = 'start', maxHeight = MAX_HEIGHT, children }: Props) {
  const window = useWindowDimensions();
  const left = anchor ? (align === 'end' ? anchor.x + anchor.w - width : anchor.x) : 0;
  const belowTop = anchor ? anchor.y + anchor.h + GAP : 0;
  const roomBelow = window.height - belowTop - EDGE;
  const roomAbove = anchor ? anchor.y - GAP - EDGE : 0;
  const flip = anchor !== null && roomBelow < Math.min(maxHeight, 360) && roomAbove > roomBelow;
  const height = Math.max(160, Math.min(maxHeight, flip ? roomAbove : roomBelow));
  const vertical = flip ? { bottom: window.height - (anchor?.y ?? 0) + GAP } : { top: belowTop };
  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      <Pressable accessible={false} onPress={onClose} className="absolute inset-0" />
      {anchor ? (
        <View
          role="dialog"
          accessibilityLabel={label}
          className="absolute overflow-hidden rounded-2xl border border-divider bg-card"
          style={{ left: Math.max(EDGE, Math.min(left, window.width - width - EDGE)), ...vertical, width, maxHeight: height, boxShadow: '0 16px 48px rgba(0,0,0,0.22)' } as never}
        >
          {children}
        </View>
      ) : null}
    </Modal>
  );
}
