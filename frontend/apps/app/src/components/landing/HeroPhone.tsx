import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Activity, Bell, CircleUser, House, Search, Users, Utensils } from 'lucide-react-native';
import { formatCurrency } from '@commontab/core';
import { colors } from '@commontab/ui';
import { BrandMark } from '@/components/ui/BrandMark';
import { DevicePhone } from '@/components/landing/DevicePhone';
import { INK, OK, StatusBar } from '@/components/landing/PhoneParts';
import { decimalOnly } from '@/lib/amountInput';
import { liveSplit } from '@/lib/liveSplit';

const L = colors.light;
const NAMES = ['You', 'Sam', 'Riya'];
const COUNTS = [2, 3, 4, 5, 7];
const TABS = [{ label: 'Home', icon: House }, { label: 'Groups', icon: Users }, { label: 'Activity', icon: Activity }, { label: 'Account', icon: CircleUser }];
const usd = (units: number) => formatCurrency(units, 'USD');
const TABULAR = { fontVariant: ['tabular-nums'] } as const;

function RoundButton({ children }: { children: React.ReactNode }) {
  return <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: L.divider, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

function Line({ left, right, color = INK, strong, last }: { left: string; right: string; color?: string; strong?: boolean; last?: boolean }) {
  return (
    <View style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: last ? 0 : 1, borderBottomColor: L.divider }}>
      <Text style={{ fontSize: 14, color: strong ? color : L['fg-soft'], fontWeight: strong ? '700' : '400' }}>{left}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color, ...TABULAR }}>{right}</Text>
    </View>
  );
}

export function HeroPhone({ onAdd }: { onAdd: () => void }) {
  const [amount, setAmount] = useState('163.50');
  const [people, setPeople] = useState(3);
  const { total, shares } = liveSplit(amount, people);
  const shown = shares.slice(0, NAMES.length);
  const rest = shares.slice(NAMES.length);
  const summary = shares.length > 0 ? `Equally · ${usd(shares[0] as number)} each` : 'Enter an amount';

  return (
    <DevicePhone>
      <StatusBar />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BrandMark size={30} />
          <Text style={{ fontSize: 18, letterSpacing: -0.72, color: INK }}><Text style={{ fontWeight: '700' }}>Common</Text><Text style={{ fontWeight: '400' }}>Tab</Text></Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <RoundButton><Search size={18} color={INK} strokeWidth={1.9} /></RoundButton>
          <RoundButton><Bell size={18} color={INK} strokeWidth={1.9} /></RoundButton>
        </View>
      </View>

      <View style={{ marginHorizontal: 12, borderRadius: 24, backgroundColor: L.background, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontSize: 15, color: L['fg-soft'] }}>You're owed</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.66, color: INK, ...TABULAR }}>$41.20</Text>
        </View>

        <View>
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, color: L.muted }}>Dinner at Uchi · {summary}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 40, lineHeight: 46, fontWeight: '600', letterSpacing: -2, color: INK }}>$</Text>
            <TextInput
              accessibilityLabel="Bill total in dollars"
              value={amount}
              onChangeText={(text) => setAmount(decimalOnly(text).slice(0, 10))}
              inputMode="decimal"
              keyboardType="decimal-pad"
              style={{ flex: 1, minWidth: 0, fontSize: 40, lineHeight: 46, fontWeight: '600', letterSpacing: -2, color: INK, outlineStyle: 'none', ...TABULAR } as never}
            />
          </View>
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="People splitting the bill" style={{ flexDirection: 'row', gap: 6 }}>
          {COUNTS.map((count) => {
            const selected = count === people;
            return (
              <Pressable
                key={count}
                accessibilityRole="radio"
                accessibilityLabel={`${count} people`}
                accessibilityState={{ selected }}
                onPress={() => setPeople(count)}
                className="active:opacity-80"
                style={{ flex: 1, minHeight: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? L.primary : '#FFFFFF' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? L.mint : INK }}>{count}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 14, minHeight: 5 * 32 }}>
          {shown.map((units, index) => (
            <Line key={NAMES[index]} left={`${NAMES[index]} ${index === 0 ? 'pay' : 'pays'}`} right={usd(units)} />
          ))}
          {rest.length > 0 ? <Line left={`${rest.length} more ${rest.length === 1 ? 'person' : 'people'}`} right={usd(rest.reduce((a, b) => a + b, 0))} /> : null}
          <Line left="Adds up to" right={usd(total)} color={OK} strong last />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Add expense" onPress={onAdd} className="active:opacity-80" style={{ minHeight: 42, borderRadius: 999, backgroundColor: L.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: L.mint }}>Add expense</Text>
        </Pressable>
      </View>

      <View style={{ marginHorizontal: 12, marginTop: 10, borderRadius: 24, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, boxShadow: '0 0 0 1px #ECEEF0' } as never}>
        <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: L.divider, alignItems: 'center', justifyContent: 'center' }}>
          <Utensils size={18} color={INK} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: INK }}>Dinner at Uchi</Text>
          <Text style={{ fontSize: 12, color: L.muted }}>You paid {usd(total)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: OK, ...TABULAR }}>{usd(Math.max(0, total - (shares[0] ?? 0)))}</Text>
          <Text style={{ fontSize: 11, color: L.muted }}>you lent</Text>
        </View>
      </View>

      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } as never}>
        {TABS.map(({ label, icon: Glyph }, index) => (
          <View key={label} style={{ alignItems: 'center', justifyContent: 'center', minWidth: 60, height: 52, borderRadius: 26, backgroundColor: index === 0 ? L.background : 'transparent' }}>
            <Glyph size={20} color={index === 0 ? INK : L.tab} strokeWidth={1.9} />
            <Text style={{ fontSize: 11, fontWeight: index === 0 ? '700' : '500', color: index === 0 ? INK : L.tab }}>{label}</Text>
          </View>
        ))}
      </View>
    </DevicePhone>
  );
}
