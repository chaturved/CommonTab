import type { ReactNode } from 'react';
import { View } from 'react-native';

export const DEVICE = { width: 340, height: 664 };

export function DevicePhone({ children }: { children: ReactNode }) {
  return (
    <View style={{ width: DEVICE.width, height: DEVICE.height, borderRadius: 56, padding: 13, backgroundColor: '#0B0F10', boxShadow: '0 40px 90px rgba(0,0,0,0.3)' } as never}>
      <View style={{ flex: 1, borderRadius: 44, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>{children}</View>
    </View>
  );
}
