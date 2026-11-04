import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import { evaluateItemized, formatCurrency, type ItemizedResult, type ItemRow } from '@commontab/core';
import { Banner, Button, Card, Icon, Text, useThemeColors } from '@commontab/ui';

export interface Person {
  id: string;
  name: string;
}

const decimalOnly = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

export function ItemizedEditor({ people, currencyCode, onResult }: { people: Person[]; currencyCode: string; onResult: (result: ItemizedResult | null) => void }) {
  const colors = useThemeColors();
  const [items, setItems] = useState<ItemRow[]>([{ name: '', priceText: '', assignedTo: [] }]);
  const [taxText, setTaxText] = useState('');
  const [tipPercent, setTipPercent] = useState('');
  const peopleIds = people.map((p) => p.id);
  const outcome = useMemo(() => evaluateItemized({ people: peopleIds, items, taxText, tipPercent }, currencyCode), [peopleIds.join(','), items, taxText, tipPercent, currencyCode]);

  useEffect(() => {
    onResult(outcome.ok ? outcome.result : null);
  }, [outcome]);

  const update = (index: number, change: Partial<ItemRow>) => setItems((all) => all.map((row, i) => (i === index ? { ...row, ...change } : row)));
  const toggle = (index: number, personId: string) =>
    setItems((all) => all.map((row, i) => (i === index ? { ...row, assignedTo: row.assignedTo.includes(personId) ? row.assignedTo.filter((p) => p !== personId) : [...row.assignedTo, personId] } : row)));
  const input = { borderColor: colors['field-border'], outlineStyle: 'none' } as never;
  const show = (units: number) => formatCurrency(units, currencyCode);

  return (
    <View className="gap-3">
      <Text variant="label" tone="muted">Who had what</Text>
      {items.map((item, index) => (
        <Card key={index} className="gap-2.5 p-3">
          <View className="flex-row items-center gap-2">
            <TextInput accessibilityLabel={`Item ${index + 1} name`} value={item.name} onChangeText={(name) => update(index, { name })} placeholder="Item" placeholderTextColor={colors.muted} className="min-h-touch min-w-0 flex-1 rounded-input border bg-background px-3 text-body text-fg" style={input} />
            <TextInput accessibilityLabel={`Item ${index + 1} price`} value={item.priceText} onChangeText={(text) => update(index, { priceText: decimalOnly(text) })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} className="min-h-touch w-24 rounded-input border bg-background px-3 text-right text-body font-semibold text-fg" style={input} />
            {items.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove item ${index + 1}`} hitSlop={8} onPress={() => setItems((all) => all.filter((_, i) => i !== index))} className="h-11 w-8 items-center justify-center">
                <Icon icon={X} size={18} strokeWidth={2.2} tone="muted" />
              </Pressable>
            ) : null}
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {people.map((person) => {
              const on = item.assignedTo.includes(person.id);
              return (
                <Pressable key={person.id} accessibilityRole="checkbox" accessibilityLabel={`${person.name} had ${item.name || `item ${index + 1}`}`} accessibilityState={{ checked: on }} onPress={() => toggle(index, person.id)} className={`min-h-touch justify-center rounded-pill px-3.5 ${on ? 'bg-primary' : 'bg-background'}`}>
                  <Text variant="body-small" tone={on ? 'on-primary' : 'fg-soft'} className="font-semibold">{person.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}
      <Button label="Add item" variant="ghost" icon={<Icon icon={Plus} size={18} strokeWidth={2.4} tone="accent" />} onPress={() => setItems((all) => [...all, { name: '', priceText: '', assignedTo: [] }])} />
      <View className="flex-row gap-2.5">
        <View className="flex-1 gap-1">
          <Text variant="caption" tone="muted" className="text-[13px] font-bold">Tax</Text>
          <TextInput accessibilityLabel="Tax" value={taxText} onChangeText={(text) => setTaxText(decimalOnly(text))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} className="min-h-touch rounded-input border bg-card px-3 text-body text-fg" style={input} />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="caption" tone="muted" className="text-[13px] font-bold">Tip %</Text>
          <TextInput accessibilityLabel="Tip percent" value={tipPercent} onChangeText={(text) => setTipPercent(decimalOnly(text))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} className="min-h-touch rounded-input border bg-card px-3 text-body text-fg" style={input} />
        </View>
      </View>
      {outcome.ok ? (
        <Card className="gap-1 p-4">
          <Text variant="body-small" tone="muted">Receipt total</Text>
          <Text variant="section" accessibilityLabel={`Receipt total ${show(outcome.result.total)}`}>{show(outcome.result.total)}</Text>
          <Text variant="caption" tone="muted" className="text-[13px]">Items {show(outcome.result.subtotal)} · Tax and tip {show(outcome.result.tax + outcome.result.tip)}</Text>
          <Text variant="label" tone="muted" className="pt-3">Each person pays</Text>
          {outcome.result.shares.filter((s) => s.total > 0).map((s) => (
            <View key={s.personID} accessible accessibilityLabel={`${people.find((p) => p.id === s.personID)?.name} pays ${show(s.total)}`} className="min-h-touch flex-row items-center justify-between">
              <Text variant="body" className="font-semibold">{people.find((p) => p.id === s.personID)?.name}</Text>
              <Text variant="button">{show(s.total)}</Text>
            </View>
          ))}
          <Text variant="caption" tone="muted" className="pt-1 text-[13px] leading-[18px]">Tax and tip are shared in proportion to each person's items. Rounded so the total is exactly {show(outcome.result.total)}.</Text>
        </Card>
      ) : items.some((i) => i.name || i.priceText) ? (
        <Banner tone="warning" message={outcome.message} />
      ) : null}
    </View>
  );
}
