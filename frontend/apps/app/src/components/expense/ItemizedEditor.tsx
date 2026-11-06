import { Dispatch, SetStateAction, useEffect, useMemo } from 'react';
import { Plus, X } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';
import { evaluateItemized, formatCurrency, type ItemizedResult, type ItemRow } from '@commontab/core';
import { avatarColorIndex, avatarColors, Banner, Button, Icon, Text, useThemeColors } from '@commontab/ui';
import { Eyebrow } from '@/components/ui/Section';
import { newItemRow, useItemizedDraft, type ItemizedDraft } from '@/hooks/useItemizedDraft';
import { decimalOnly } from '@/lib/amountInput';

export interface Person {
  id: string;
  name: string;
}

interface Props {
  people: Person[];
  currencyCode: string;
  onResult: (result: ItemizedResult | null) => void;
  draft?: ItemizedDraft;
  onDraft?: Dispatch<SetStateAction<ItemizedDraft>>;
  inset?: boolean;
}

export function ItemizedEditor({ people, currencyCode, onResult, draft: controlled, onDraft, inset }: Props) {
  const colors = useThemeColors();
  const own = useItemizedDraft();
  const [draft, setDraft] = controlled && onDraft ? [controlled, onDraft] : own;
  const { items, taxText, tipPercent } = draft;
  const peopleKey = people.map((p) => p.id).join(',');
  const outcome = useMemo(() => evaluateItemized({ people: peopleKey ? peopleKey.split(',') : [], items, taxText, tipPercent }, currencyCode), [peopleKey, items, taxText, tipPercent, currencyCode]);

  useEffect(() => {
    onResult(outcome.ok ? outcome.result : null);
  }, [outcome, onResult]);

  const surface = inset ? 'bg-background' : 'bg-card';
  const setItems = (change: (all: ItemRow[]) => ItemRow[]) => setDraft((d) => ({ ...d, items: change(d.items) }));
  const update = (index: number, patch: Partial<ItemRow>) => setItems((all) => all.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const toggle = (index: number, personId: string) =>
    setItems((all) => all.map((row, i) => (i === index ? { ...row, assignedTo: row.assignedTo.includes(personId) ? row.assignedTo.filter((p) => p !== personId) : [...row.assignedTo, personId] } : row)));
  const show = (units: number) => formatCurrency(units, currencyCode);
  const result = outcome.ok ? outcome.result : null;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '';

  return (
    <View className="gap-3">
      <View className={`flex-row items-center justify-between gap-3 rounded-card p-4 ${surface}`}>
        <View>
          <Text variant="body-small" tone="muted">Receipt total</Text>
          <Text variant="large-title" accessibilityLabel={`Receipt total ${show(result?.total ?? 0)}`}>{show(result?.total ?? 0)}</Text>
        </View>
        <View className="items-end">
          <Text variant="caption" tone="muted" className="text-[13px]">Items {show(result?.subtotal ?? 0)}</Text>
          <Text variant="caption" tone="muted" className="text-[13px]">Tax and tip {show((result?.tax ?? 0) + (result?.tip ?? 0))}</Text>
        </View>
      </View>

      <Eyebrow>WHO HAD WHAT</Eyebrow>
      <View className={`overflow-hidden rounded-card ${surface}`}>
        {items.map((item, index) => (
          <View key={index} className="gap-2 border-b border-divider px-4 py-3">
            <View className="flex-row items-center gap-2">
              <TextInput accessibilityLabel={`Item ${index + 1} name`} value={item.name} onChangeText={(name) => update(index, { name })} placeholder="Item" placeholderTextColor={colors.muted} className="min-h-touch min-w-0 flex-1 text-body font-semibold text-fg" style={{ outlineStyle: 'none' } as never} />
              <TextInput accessibilityLabel={`Item ${index + 1} price`} value={item.priceText} onChangeText={(text) => update(index, { priceText: decimalOnly(text) })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} className="min-h-touch w-24 text-right text-body font-bold text-fg" style={{ outlineStyle: 'none' } as never} />
              {items.length > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove item ${index + 1}`} hitSlop={8} onPress={() => setItems((all) => all.filter((_, i) => i !== index))} className="h-11 w-8 items-center justify-center">
                  <Icon icon={X} size={18} strokeWidth={2.2} tone="muted" />
                </Pressable>
              ) : null}
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {people.map((person) => {
                const on = item.assignedTo.includes(person.id);
                const swatch = avatarColors[avatarColorIndex(person.id)]!;
                return (
                  <Pressable
                    key={person.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${person.name} had ${item.name || `item ${index + 1}`}`}
                    accessibilityState={{ checked: on }}
                    onPress={() => toggle(index, person.id)}
                    className="min-h-[36px] justify-center rounded-pill border px-3.5 active:opacity-80"
                    style={on ? { backgroundColor: swatch.bg, borderColor: swatch.bg } : { borderColor: colors['field-border'] }}
                  >
                    <Text variant="body-small" className="font-semibold" style={{ color: on ? swatch.fg : colors.muted }}>{person.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Button label="Add item" variant="ghost" icon={<Icon icon={Plus} size={18} strokeWidth={2.4} tone="accent" />} onPress={() => setItems((all) => [...all, newItemRow()])} />
      </View>

      <View className="flex-row gap-3">
        <View className={`flex-1 rounded-card px-4 py-2 ${surface}`}>
          <Text variant="caption" tone="muted" className="text-[13px] font-bold">Tax</Text>
          <TextInput accessibilityLabel="Tax" value={taxText} onChangeText={(text) => setDraft((d) => ({ ...d, taxText: decimalOnly(text) }))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} className="min-h-touch text-body font-semibold text-fg" style={{ outlineStyle: 'none' } as never} />
        </View>
        <View className={`flex-1 rounded-card px-4 py-2 ${surface}`}>
          <Text variant="caption" tone="muted" className="text-[13px] font-bold">Tip %</Text>
          <TextInput accessibilityLabel="Tip percent" value={tipPercent} onChangeText={(text) => setDraft((d) => ({ ...d, tipPercent: decimalOnly(text) }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} className="min-h-touch text-body font-semibold text-fg" style={{ outlineStyle: 'none' } as never} />
        </View>
      </View>

      {result ? (
        <>
          <Eyebrow>EACH PERSON PAYS</Eyebrow>
          <View className={`overflow-hidden rounded-card ${surface}`}>
            {result.shares.filter((s) => s.total > 0).map((s, i, all) => (
              <View key={s.personID} accessible accessibilityLabel={`${nameOf(s.personID)} pays ${show(s.total)}`} className={`min-h-row flex-row items-center justify-between px-4 ${i < all.length - 1 ? 'border-b border-divider' : ''}`}>
                <Text variant="body" className="font-semibold">{nameOf(s.personID)}</Text>
                <Text variant="button">{show(s.total)}</Text>
              </View>
            ))}
          </View>
          <Text variant="caption" tone="muted" className="px-1 text-[13px] leading-[18px]">Tax and tip are shared in proportion to each person's items. Rounded so the total is exactly {show(result.total)}.</Text>
        </>
      ) : items.some((i) => i.name || i.priceText) && !outcome.ok ? (
        <Banner tone="warning" message={outcome.message} />
      ) : null}
    </View>
  );
}
