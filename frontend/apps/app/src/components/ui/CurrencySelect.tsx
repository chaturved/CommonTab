import { ReactNode, useState } from 'react';
import { Check, Search } from 'lucide-react-native';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Icon, Sheet, Text, useThemeColors } from '@commontab/ui';
import { CURRENCIES, matchCurrencies } from '@/constants/currencies';
import { Popover } from '@/components/ui/Popover';
import { useWindowAnchor } from '@/hooks/useWindowAnchor';
import { useIsDesktop } from '@/hooks/useViewport';

const WIDTH = 300;

export function CurrencySelect({ value, onChange, children }: { value: string; onChange: (code: string) => void; children: (open: () => void, isOpen: boolean) => ReactNode }) {
  const desktop = useIsDesktop();
  const colors = useThemeColors();
  const { ref: anchorRef, box: anchor, measure } = useWindowAnchor();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const options = matchCurrencies(query);

  const show = () => {
    setQuery('');
    if (!desktop) return setOpen(true);
    measure(() => setOpen(true));
  };
  const close = () => setOpen(false);
  const pick = (code: string) => {
    onChange(code);
    close();
  };

  const list = (
    <>
      <View className="flex-row items-center gap-2 border-b border-divider px-3.5">
        <Icon icon={Search} size={16} strokeWidth={2.2} tone="muted" />
        <TextInput accessibilityLabel="Search currencies" value={query} onChangeText={setQuery} placeholder="Search currencies" placeholderTextColor={colors.muted} autoFocus autoCapitalize="none" autoCorrect={false} className="min-h-[44px] min-w-0 flex-1 text-body text-fg" style={{ outlineStyle: 'none' } as never} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" className="shrink">
        {options.map((c) => (
          <Pressable key={c.code} accessibilityRole="button" accessibilityLabel={`${c.code} ${c.name}${c.code === value ? ', selected' : ''}`} onPress={() => pick(c.code)} className="min-h-[44px] flex-row items-center gap-3 px-3.5 active:opacity-80">
            <Text variant="body-small" className="w-11 font-bold">{c.code}</Text>
            <Text variant="body-small" tone="muted" className="flex-1">{c.name}</Text>
            {c.code === value ? <Icon icon={Check} size={16} strokeWidth={2.6} tone="accent" /> : null}
          </Pressable>
        ))}
        {options.length === 0 ? <Text variant="body-small" tone="muted" className="px-3.5 py-4">No currency matches “{query}”.</Text> : null}
      </ScrollView>
    </>
  );

  return (
    <>
      <View ref={anchorRef} collapsable={false}>{children(show, open)}</View>
      {desktop ? (
        <Popover visible={open} onClose={close} anchor={anchor} label="Currency" width={WIDTH} align="end">
          {list}
        </Popover>
      ) : (
        <Sheet visible={open} onClose={close} title="Currency">
          <View className="overflow-hidden rounded-2xl bg-background">{list}</View>
        </Sheet>
      )}
    </>
  );
}

export const currencyLabel = (code: string) => `${code} · ${CURRENCIES.find((c) => c.code === code)?.name ?? code}`;
