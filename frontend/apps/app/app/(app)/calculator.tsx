import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import { formatCurrency, formatMinorUnits, parseMinorUnits, tipSplit, type ItemizedResult } from '@commontab/core';
import { BackButton, Button, Card, Icon, SegmentedControl, Text, useThemeColors } from '@commontab/ui';
import { ItemizedEditor } from '../../src/components/ItemizedEditor';
import { PageHeader } from '../../src/components/PageHeader';
import { Screen } from '../../src/components/Screen';
import { useIsDesktop } from '../../src/layout';

const CURRENCY = 'USD';
const TIPS = ['15', '18', '20', '25'];

const decimalOnly = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

export default function Calculator() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const colors = useThemeColors();
  const [tab, setTab] = useState<'person' | 'item'>('person');
  const [billText, setBillText] = useState('');
  const [tip, setTip] = useState('20');
  const [people, setPeople] = useState(2);
  const [itemResult, setItemResult] = useState<ItemizedResult | null>(null);
  const [itemPeople, setItemPeople] = useState(2);

  let bill: number | null = null;
  try {
    bill = billText.trim() === '' ? null : parseMinorUnits(billText, CURRENCY);
  } catch {
    bill = null;
  }
  const split = bill !== null ? tipSplit({ billMinor: bill, tipPercent: tip || '0', people }) : null;
  const show = (units: number) => formatCurrency(units, CURRENCY);
  const total = tab === 'person' ? split?.totalMinor : itemResult?.total;
  const saveAsExpense = () => router.push({ pathname: '/add-expense', params: { amount: formatMinorUnits(total ?? 0, CURRENCY) } });
  const resultCard = split ? (
              <Card className="gap-1 p-4" accessible accessibilityLabel={`Tip ${show(split.tipMinor)}. Total ${show(split.totalMinor)}. Per person ${show(Math.max(...split.shares))}`}>
                <Row label={`Tip (${tip || 0}%)`} value={show(split.tipMinor)} />
                <Row label="Total" value={show(split.totalMinor)} />
                <Text variant="label" tone="muted" className="pt-3">Per person</Text>
                <Text variant="large-title" tone="accent" className="text-[40px] leading-[46px]">{show(Math.max(...split.shares))}</Text>
                {new Set(split.shares).size > 1 ? <Text variant="caption" tone="muted" className="text-[13px]">Some people pay a cent less so the total is exact.</Text> : null}
              </Card>
  ) : null;
  const names = Array.from({ length: itemPeople }, (_, i) => ({ id: `p${i + 1}`, name: `Person ${i + 1}` }));

  return (
    <Screen wide footer={desktop ? undefined : <View className="w-full max-w-[560px] self-center"><Button label="Save as expense" disabled={!total} onPress={saveAsExpense} /></View>}>
      {desktop ? (
        <PageHeader title="Tip & split calculator" subtitle="Split a restaurant bill by person or by item" actions={<Button label="Save as expense" size="small" disabled={!total} onPress={saveAsExpense} />} />
      ) : (
        <View className="min-h-touch w-full max-w-[560px] flex-row items-center justify-between self-center">
          <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))} />
          <Text variant="screen-title" accessibilityRole="header">Tip & split</Text>
          <View className="w-11" />
        </View>
      )}
      <View className={desktop ? 'w-full gap-4' : 'w-full max-w-[560px] gap-4 self-center'}>
        <SegmentedControl options={[{ key: 'person', label: 'By person' }, { key: 'item', label: 'By item' }]} value={tab} onChange={(key) => setTab(key as 'person' | 'item')} />
        {tab === 'person' ? (
          <View className={desktop ? 'flex-row items-start gap-[22px]' : 'gap-4'}>
            <View className="min-w-0 flex-1 gap-4">
            <View className="gap-1 rounded-card bg-card px-4 py-3">
              <Text variant="caption" tone="muted" className="text-[13px] font-bold">Bill before tip</Text>
              <View className="flex-row items-center gap-2">
                <Text variant="large-title" tone="muted" className="text-[34px]">$</Text>
                <TextInput accessibilityLabel="Bill before tip" value={billText} onChangeText={(t) => setBillText(decimalOnly(t))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} className="min-h-[48px] min-w-0 flex-1 text-[34px] font-extrabold text-fg" style={{ outlineStyle: 'none' } as never} />
              </View>
            </View>
            <Text variant="label" tone="muted">Tip</Text>
            <View className="flex-row gap-2">
              {TIPS.map((t) => (
                <Pressable key={t} accessibilityRole="button" accessibilityLabel={`${t} percent tip`} accessibilityState={{ selected: tip === t }} onPress={() => setTip(t)} className={`min-h-touch flex-1 items-center justify-center rounded-pill ${tip === t ? 'bg-primary' : 'bg-card'}`}>
                  <Text variant="body-small" tone={tip === t ? 'on-primary' : 'fg-soft'} className="font-bold">{t}%</Text>
                </Pressable>
              ))}
            </View>
            <Text variant="label" tone="muted">People</Text>
            <Stepper value={people} onChange={setPeople} label="people" />
            {desktop ? null : resultCard}
            </View>
            {desktop ? <View className="min-w-0 flex-1">{resultCard}</View> : null}
          </View>
        ) : (
          <>
            <Text variant="label" tone="muted">People</Text>
            <Stepper value={itemPeople} onChange={setItemPeople} label="people" />
            <ItemizedEditor people={names} currencyCode={CURRENCY} onResult={setItemResult} />
          </>
        )}
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-touch flex-row items-center justify-between">
      <Text variant="body-small" tone="muted">{label}</Text>
      <Text variant="button">{value}</Text>
    </View>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <View className="flex-row items-center justify-between rounded-card bg-card px-3 py-2">
      <Pressable accessibilityRole="button" accessibilityLabel={`Fewer ${label}`} disabled={value <= 1} onPress={() => onChange(value - 1)} className="h-11 w-11 items-center justify-center rounded-pill bg-background active:opacity-80">
        <Icon icon={Minus} size={20} strokeWidth={2.4} tone="accent" />
      </Pressable>
      <Text variant="section" accessibilityLabel={`${value} ${label}`}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${label}`} disabled={value >= 20} onPress={() => onChange(value + 1)} className="h-11 w-11 items-center justify-center rounded-pill bg-background active:opacity-80">
        <Icon icon={Plus} size={20} strokeWidth={2.4} tone="accent" />
      </Pressable>
    </View>
  );
}
