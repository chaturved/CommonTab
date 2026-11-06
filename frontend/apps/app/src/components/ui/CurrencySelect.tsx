import { ReactNode, useState } from 'react';
import { Check, Search } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { Icon, Sheet, Text, useThemeColors } from '@commontab/ui';
import { CURRENCIES, matchCurrencies } from '@/constants/currencies';
import { useWindowAnchor } from '@/hooks/useWindowAnchor';
import { useIsDesktop } from '@/hooks/useViewport';

const WIDTH = 300;

export function CurrencySelect({ value, onChange, children }: { value: string; onChange: (code: string) => void; children: (open: () => void) => ReactNode }) {
  const desktop = useIsDesktop();
  const colors = useThemeColors();
  const window = useWindowDimensions();
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
      <View ref={anchorRef} collapsable={false}>{children(show)}</View>
      {desktop ? (
        <Modal transparent visible={open} onRequestClose={close} animationType="fade">
          <Pressable accessible={false} onPress={close} className="absolute inset-0" />
          {anchor ? (
            <View role="dialog" accessibilityLabel="Currency" className="absolute overflow-hidden rounded-2xl border border-divider bg-card" style={{ left: Math.max(12, Math.min(anchor.x + anchor.w - WIDTH, window.width - WIDTH - 12)), top: Math.min(anchor.y + anchor.h + 6, Math.max(12, window.height - 372)), width: WIDTH, maxHeight: 360, boxShadow: '0 16px 48px rgba(0,0,0,0.22)' } as never}>
              {list}
            </View>
          ) : null}
        </Modal>
      ) : (
        <Sheet visible={open} onClose={close} title="Currency">
          <View className="overflow-hidden rounded-2xl bg-background">{list}</View>
        </Sheet>
      )}
    </>
  );
}

export const currencyLabel = (code: string) => `${code} · ${CURRENCIES.find((c) => c.code === code)?.name ?? code}`;
