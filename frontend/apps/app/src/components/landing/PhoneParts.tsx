import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors } from '@commontab/ui';

const L = colors.light;
export const INK = L.fg;
export const OK = L.accent;
export const AMBER = L['warn-icon'];
export const TABULAR = { fontVariant: ['tabular-nums'] } as const;
const RING = { boxShadow: `0 0 0 1px ${L.divider}` };

export function PhoneShell({ width, height, radius, shadow, flat, children }: { width: number; height: number; radius: number; shadow: number; flat?: boolean; children: ReactNode }) {
  return (
    <View style={{ width, height, backgroundColor: '#FFFFFF', overflow: 'hidden', borderTopLeftRadius: radius, borderTopRightRadius: radius, borderBottomLeftRadius: flat ? 0 : radius, borderBottomRightRadius: flat ? 0 : radius, boxShadow: `0 30px 80px rgba(0,0,0,${shadow})` } as never}>
      {children}
    </View>
  );
}

export function StatusBar() {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: INK }}>9:41</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: INK }}>LTE ▮</Text>
    </View>
  );
}

export function Tile({ children, flush, row }: { children: ReactNode; flush?: boolean; row?: boolean }) {
  return (
    <View style={{ borderRadius: 20, backgroundColor: '#FFFFFF', marginHorizontal: 12, marginVertical: 8, paddingVertical: flush ? 4 : 14, paddingHorizontal: 16, flexDirection: row ? 'row' : 'column', justifyContent: 'space-between', alignItems: row ? 'center' : undefined, ...RING } as never}>
      {children}
    </View>
  );
}

export const Small = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 13, color: L.muted }}>{children}</Text>;

export const Big = ({ children, size = 36 }: { children: ReactNode; size?: number }) => (
  <Text style={{ fontSize: size, lineHeight: size * 1.1, fontWeight: '600', letterSpacing: -size * 0.05, color: INK, ...TABULAR }}>{children}</Text>
);

export function Avatar({ letter }: { letter: string }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: L.divider, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: INK }}>{letter}</Text>
    </View>
  );
}

export function Row({ left, right, avatar, color = INK, strong, last }: { left: string; right: string; avatar?: string; color?: string; strong?: boolean; last?: boolean }) {
  return (
    <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: last ? 0 : 1, borderBottomColor: L.divider }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {avatar ? <Avatar letter={avatar} /> : null}
        <Text style={{ fontSize: 15, color: strong ? color : INK, fontWeight: strong ? '700' : '400' }}>{left}</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color, ...TABULAR }}>{right}</Text>
    </View>
  );
}

export const TitleBar = ({ title }: { title: string }) => (
  <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
    <Text style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.66, color: INK }}>{title}</Text>
  </View>
);
