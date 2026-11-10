import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@commontab/ui';
import { BrandMark } from '@/components/ui/BrandMark';

interface Props {
  signedIn: boolean;
  onLight: boolean;
  onStart: () => void;
  onSignIn: () => void;
  onJump: (anchor: 'product' | 'how' | 'download') => void;
}

const MENU_LINKS = [['Product', 'product'], ['How it works', 'how'], ['Download', 'download']] as const;
const WIDE_ONLY = 'hidden min-[520px]:flex';

export function TopBar({ signedIn, onLight, onStart, onSignIn, onJump }: Props) {
  const [open, setOpen] = useState(false);
  const pick = (action: () => void) => () => { setOpen(false); action(); };
  const startLabel = signedIn ? 'Open app' : 'Sign up';

  return (
    <View className="absolute inset-x-0 top-0 z-30">
      <View className="flex-row items-center justify-between p-5">
        <View className="min-w-0 shrink flex-row items-center gap-2">
          <View aria-hidden className="h-[46px] w-[46px] items-center justify-center rounded-[12px] bg-hero-to">
            <BrandMark size={34} />
          </View>
          <Text numberOfLines={1} accessibilityRole="header" accessibilityLabel="CommonTab" className={`shrink text-[18px] tracking-[-0.72px] ${onLight ? 'text-fg' : 'text-white'}`}>
            <Text className="font-bold">Common</Text>
            <Text className="font-normal">Tab</Text>
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Button label={`${startLabel} →`} variant="mint" size="small" className={WIDE_ONLY} onPress={onStart} />
          {signedIn ? null : <Button label="Log in" variant="deep" size="small" className={WIDE_ONLY} onPress={onSignIn} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? 'Close menu' : 'Open menu'}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen(!open)}
            className="h-[46px] w-[46px] items-center justify-center rounded-full bg-hero-to active:opacity-80"
          >
            <Text className="text-[20px] leading-[20px] text-white">{open ? '×' : '☰'}</Text>
          </Pressable>
        </View>
      </View>
      {open ? (
        <View className="absolute right-5 top-[76px] min-w-[200px] rounded-[20px] bg-hero-to p-2">
          {MENU_LINKS.map(([label, anchor]) => (
            <Pressable key={anchor} accessibilityRole="link" accessibilityLabel={label} onPress={pick(() => onJump(anchor))} className="min-h-touch justify-center px-4 active:opacity-80">
              <Text className="text-[15px] text-white">{label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="link" accessibilityLabel={startLabel} onPress={pick(onStart)} className="min-h-touch justify-center px-4 active:opacity-80 min-[520px]:hidden">
            <Text className="text-[15px] font-semibold text-mint">{startLabel}</Text>
          </Pressable>
          {signedIn ? null : (
            <Pressable accessibilityRole="link" accessibilityLabel="Sign in" onPress={pick(onSignIn)} className="min-h-touch justify-center px-4 active:opacity-80">
              <Text className="text-[15px] text-white">Sign in</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
