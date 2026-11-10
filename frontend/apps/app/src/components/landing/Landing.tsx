import { useRouter } from 'expo-router';
import { Button } from '@commontab/ui';
import { ScrollView, Text, View } from 'react-native';
import { HeroPhone } from '@/components/landing/HeroPhone';
import { PinnedFeatures } from '@/components/landing/PinnedFeatures';
import { StatCards } from '@/components/landing/StatCards';
import { TallCards } from '@/components/landing/TallCards';
import { TopBar } from '@/components/landing/TopBar';
import { PINNED_STEPS } from '@/constants/landing';
import { usePinnedStep } from '@/hooks/usePinnedStep';
import { useScrollAnchors } from '@/hooks/useScrollAnchors';

type Anchor = 'product' | 'how' | 'download';
type Path = '/home' | '/sign-in' | '/create-account';

const HERO_BACKGROUND = { backgroundImage: 'linear-gradient(160deg, #0B4350, #06222B)' };
const HERO_HEADING ={ fontSize: 'clamp(46px, 6.2vw, 92px)', fontWeight: '300', letterSpacing: '-0.045em', color: '#FFFFFF' };
const BAND_HEADING = { fontSize: 'clamp(36px, 4.6vw, 56px)', fontWeight: '300', letterSpacing: '-0.045em', color: '#FFFFFF' };
const BAND = 'w-full items-center bg-site-bg px-5';

export function Landing({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const { scroll, mark, jump } = useScrollAnchors<Anchor>();
  const pinned = usePinnedStep(PINNED_STEPS.length);
  const go = (path: Path) => router.push(path);
  const start = (): Path => (signedIn ? '/home' : '/create-account');
  const startLabel = signedIn ? 'Open the app →' : 'Get started free →';

  const heroCopy = (
    <View style={{ maxWidth: 340, gap: 24 }}>
      <Text style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: '#FFFFFF' }}>CommonTab splits every bill to the cent, keeps the balances, and works when your signal doesn't.</Text>
      <Button label={startLabel} variant="mint" size="small" className="self-start" onPress={() => go(start())} />
    </View>
  );

  return (
    <View className="flex-1 bg-site-bg">
      <ScrollView ref={scroll} className="flex-1" contentContainerClassName="items-center" onScroll={pinned.onScroll} scrollEventThrottle={16}>
        <View className="w-full overflow-hidden px-5 pt-24 lg:h-screen lg:min-h-[820px] lg:flex-row lg:gap-12 lg:pt-0" style={HERO_BACKGROUND as never}>
          <View className="lg:flex-1 lg:justify-center">
            <Text accessibilityRole="header" aria-level={1} className="leading-[0.95]" style={HERO_HEADING as never}>Nobody should do bill math twice.</Text>
            <View className="mt-5 lg:hidden">{heroCopy}</View>
          </View>
          <View className="mt-9 self-center pb-12 lg:pb-0">
            <HeroPhone onAdd={() => go(start())} />
          </View>
          <View className="hidden lg:flex lg:flex-1 lg:justify-center">{heroCopy}</View>
        </View>

        <PinnedFeatures
          step={pinned.step}
          onLayout={((e: never) => { pinned.onLayout(e); mark('product').onLayout(e); }) as never}
          onAction={(action) => (action === 'start' ? go(start()) : jump('how'))}
        />

        <View {...mark('how')} className={`${BAND} py-24`}>
          <View className="w-full max-w-[1480px]">
            <View className="flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <View style={{ maxWidth: 720 }}>
                <Text accessibilityRole="header" className="leading-none" style={BAND_HEADING as never}>Make a group. Add a bill. Settle up.</Text>
                <Text style={{ fontSize: 20, lineHeight: 28, letterSpacing: -0.4, color: '#FFFFFF', marginTop: 16 }}>A trip, an apartment, a dinner crew. Invite people with a code.</Text>
              </View>
              <Button label="Start a group" variant="invert" size="small" className="self-start" onPress={() => go(start())} />
            </View>
            <TallCards />
          </View>
        </View>

        <View {...mark('download')} className={`${BAND} pb-24`}>
          <View className="w-full max-w-[1480px]">
            <Text accessibilityRole="header" className="leading-none" style={{ ...BAND_HEADING, maxWidth: 760 } as never}>Built so the numbers always match.</Text>
            <StatCards cta={signedIn ? 'Open the app' : 'Sign up now'} onCta={() => go(start())} />
          </View>
        </View>

        <View className="w-full max-w-[1480px] flex-row flex-wrap items-center justify-between gap-3 px-5 py-10">
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E8F1F0' }}>CommonTab</Text>
          <Text style={{ fontSize: 13, color: '#8FA9AB' }}>Privacy   Terms   © 2026 CommonTab</Text>
        </View>
      </ScrollView>

      <TopBar signedIn={signedIn} onLight={pinned.onLight} onStart={() => go(start())} onSignIn={() => go('/sign-in')} onJump={jump} />
    </View>
  );
}
