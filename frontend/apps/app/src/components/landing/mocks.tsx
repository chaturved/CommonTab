import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@commontab/ui';

const L = colors.light;
const BEZEL = '#02090C';
const SHADOW = '0 40px 90px rgba(0,0,0,0.55)';

export function PhoneFrame({ width, height, radius, pad, rotate = 0, children }: { width: number; height: number; radius: number; pad: number; rotate?: number; children: ReactNode }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius, padding: pad, backgroundColor: BEZEL, borderWidth: 1, borderColor: 'rgba(232,241,240,0.16)', transform: [{ rotate: `${rotate}deg` }], boxShadow: SHADOW } as never}
    >
      <View style={{ flex: 1, borderRadius: radius - pad, backgroundColor: L.background, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

const money = (value: string, color: string, k: number) => <Text style={{ fontSize: 15 * k, fontWeight: '700', color }}>{value}</Text>;

function Row({ title, sub, value, color, k }: { title: string; sub: string; value: string; color: string; k: number }) {
  return (
    <View style={{ borderRadius: 17 * k, backgroundColor: L.card, paddingVertical: 12 * k, paddingHorizontal: 15 * k, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View>
        <Text style={{ fontSize: 15 * k, fontWeight: '700', color: L.fg }}>{title}</Text>
        <Text style={{ fontSize: 12 * k, color: L.muted }}>{sub}</Text>
      </View>
      {money(value, color, k)}
    </View>
  );
}

function Hero({ label, amount, chips, k }: { label: string; amount: string; chips: [string, string][]; k: number }) {
  return (
    <LinearGradient colors={[L['hero-from'], L['hero-to']]} start={{ x: 0.2, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ borderRadius: 25 * k, padding: 17 * k, gap: 5 * k }}>
      <Text style={{ fontSize: 11 * k, fontWeight: '700', letterSpacing: 11 * k * 0.1, color: L.mint }}>{label}</Text>
      <Text style={{ fontSize: 38 * k, fontWeight: '800', letterSpacing: -0.02 * 38 * k, color: '#FFFFFF' }}>{amount}</Text>
      <View style={{ flexDirection: 'row', gap: 7 * k, marginTop: 5 * k }}>
        {chips.map(([name, value]) => (
          <View key={name} style={{ flex: 1, borderRadius: 12 * k, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 7 * k, paddingHorizontal: 10 * k }}>
            <Text style={{ fontSize: 12 * k, color: '#FFFFFF' }}>{name}</Text>
            <Text style={{ fontSize: 16 * k, fontWeight: '700', color: '#FFFFFF' }}>{value}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

export function OverviewScreen({ k = 1, withSettled = true }: { k?: number; withSettled?: boolean }) {
  return (
    <View style={{ flex: 1, padding: 22 * k, gap: 12 * k }}>
      <Text style={{ fontSize: 23 * k, fontWeight: '800', letterSpacing: -0.02 * 23 * k, color: L.fg }}>CommonTab</Text>
      <Hero k={k} label="YOU'RE OWED OVERALL" amount="$97.00" chips={[['You owe', '$12.00'], ['Owed to you', '$109.00']]} />
      <Row k={k} title="Austin Trip" sub="3 members" value="$109.00" color={L.accent} />
      <Row k={k} title="Apartment" sub="3 members" value="$12.00" color={L.owe} />
      {withSettled ? <Row k={k} title="Weekend Ski" sub="Settled" value="✓" color={L.muted} /> : null}
    </View>
  );
}

export function GroupScreen() {
  const k = 0.8;
  return (
    <View style={{ flex: 1, padding: 18 * 0.9, gap: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', textAlign: 'center', color: L.fg }}>Austin Trip</Text>
      <Hero k={k} label="YOU'RE OWED" amount="$109.00" chips={[['Sam owes', '$54.50'], ['Riya owes', '$54.50']]} />
      <Row k={k} title="Dinner at Uchi" sub="You paid $163.50" value="$109.00 lent" color={L.accent} />
      <Row k={k} title="Brunch" sub="Sam paid $54.00" value="$18.00" color={L.owe} />
      <Row k={k} title="Taxi" sub="Riya paid $54.00" value="$18.00" color={L.owe} />
      <View style={{ marginTop: 'auto', borderRadius: 19, backgroundColor: L.primary, padding: 11, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Add expense</Text>
      </View>
    </View>
  );
}

export function OfflineScreen() {
  const k = 0.8;
  return (
    <View style={{ flex: 1, padding: 18 * 0.9, gap: 10 }}>
      <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: L.fg }}>CommonTab</Text>
      <View style={{ borderRadius: 12, backgroundColor: L.warn, padding: 10 }}>
        <Text style={{ fontSize: 10, lineHeight: 13.5, color: L['on-warn'] }}>You're offline. 2 changes will sync when you're back.</Text>
      </View>
      <Row k={k} title="Brunch" sub="Saved on this phone" value="$54.00" color={L['warn-icon']} />
      <Row k={k} title="Taxi" sub="Saved on this phone" value="$54.00" color={L['warn-icon']} />
      <Row k={k} title="Dinner at Uchi" sub="Synced" value="$163.50" color={L.accent} />
    </View>
  );
}
