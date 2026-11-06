import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BrandMark } from '@/components/ui/BrandMark';
import { Pill } from '@/components/landing/Pill';

const DEEP = '#06222B';

interface Props {
  signedIn: boolean;
  onLight: boolean;
  onStart: () => void;
  onSignIn: () => void;
  onJump: (anchor: 'product' | 'how' | 'download') => void;
}

export function TopBar({ signedIn, onLight, onStart, onSignIn, onJump }: Props) {
  const [open, setOpen] = useState(false);
  const pick = (action: () => void) => () => { setOpen(false); action(); };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 } as never}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View aria-hidden style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: DEEP, alignItems: 'center', justifyContent: 'center' }}>
            <BrandMark size={34} />
          </View>
          <Text accessibilityRole="header" accessibilityLabel="CommonTab" style={{ fontSize: 18, letterSpacing: -0.72, color: onLight ? '#0E1A1C' : '#FFFFFF' }}><Text style={{ fontWeight: '700' }}>Common</Text><Text style={{ fontWeight: '400' }}>Tab</Text></Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pill label={signedIn ? 'Open app →' : 'Sign up →'} look="fill" onPress={onStart} />
          {signedIn ? null : <Pill label="Log in" look="dark" onPress={onSignIn} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? 'Close menu' : 'Open menu'}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen(!open)}
            className="active:opacity-80"
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: DEEP, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 20, lineHeight: 20, color: '#FFFFFF' }}>{open ? '×' : '☰'}</Text>
          </Pressable>
        </View>
      </View>
      {open ? (
        <View style={{ position: 'absolute', top: 76, right: 20, minWidth: 200, borderRadius: 20, backgroundColor: DEEP, padding: 8 }}>
          {([['Product', 'product'], ['How it works', 'how'], ['Download', 'download']] as const).map(([label, anchor]) => (
            <Pressable key={anchor} accessibilityRole="link" accessibilityLabel={label} onPress={pick(() => onJump(anchor))} className="min-h-touch justify-center px-4 active:opacity-80">
              <Text style={{ fontSize: 15, color: '#FFFFFF' }}>{label}</Text>
            </Pressable>
          ))}
          {signedIn ? null : (
            <Pressable accessibilityRole="link" accessibilityLabel="Sign in" onPress={pick(onSignIn)} className="min-h-touch justify-center px-4 active:opacity-80">
              <Text style={{ fontSize: 15, color: '#8FE5C7' }}>Sign in</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
