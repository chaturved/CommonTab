import { useRef, type ComponentRef, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Button, Text } from '@commontab/ui';
import { BrandMark } from '../components/BrandMark';
import { useIsDesktop } from '../layout';
import { GroupScreen, OfflineScreen, OverviewScreen, PhoneFrame } from './mocks';

type Anchor = 'product' | 'how' | 'download';
type Path = '/home' | '/sign-in' | '/create-account';

const RULE = 'border-site-line';
const CARD = `rounded-[28px] border ${RULE} bg-site-card`;
const tight = (size: number, em = 0.04) => ({ letterSpacing: -size * em });

function Heading({ size, children, style }: { size: number; children: ReactNode; style?: object }) {
  return (
    <Text accessibilityRole="header" tone="site-text" className="font-semibold" style={[{ fontSize: size, lineHeight: size * 1.02, ...tight(size) }, style]}>
      {children}
    </Text>
  );
}

function FeatureCard({ title, body, desktop, children, flex, minHeight }: { title: string; body: string; desktop: boolean; children: ReactNode; flex?: number; minHeight?: number }) {
  return (
    <View className={`${CARD} justify-between gap-5 overflow-hidden ${desktop ? 'p-8' : 'p-6'}`} style={{ flex, minHeight }}>
      <View className="gap-2.5">
        <Text accessibilityRole="header" tone="site-text" className="font-semibold" style={{ fontSize: desktop ? 26 : 22, lineHeight: desktop ? 30 : 26, ...tight(desktop ? 26 : 22, 0.03) }}>{title}</Text>
        <Text tone="site-muted" className="text-[15px] leading-[22px]" style={{ maxWidth: 420 }}>{body}</Text>
      </View>
      {children}
    </View>
  );
}

function Line({ left, right, tone = 'site-text', strong }: { left: string; right: string; tone?: 'site-text' | 'site-muted' | 'mint'; strong?: boolean }) {
  return (
    <View className={`flex-row justify-between border-b py-[9px] ${RULE}`}>
      <Text variant="body-small" tone={tone} className={strong ? 'font-semibold' : undefined}>{left}</Text>
      <Text variant="body-small" tone={tone} className={strong ? 'font-semibold' : undefined} style={{ fontVariant: ['tabular-nums'] }}>{right}</Text>
    </View>
  );
}

function Chip({ label, tone = 'site-text' }: { label: string; tone?: 'site-text' | 'site-amber' }) {
  return (
    <View className={`rounded-xl border bg-site-chip px-4 py-2.5 ${RULE}`}>
      <Text variant="body-small" tone={tone} className="text-sm">{label}</Text>
    </View>
  );
}

function Split() {
  return (
    <View>
      <Line left="Bill" right="$163.50" />
      <Line left="3 people" right="÷ 3" tone="site-muted" />
      <Line left="You" right="$54.50" />
      <Line left="Sam" right="$54.50" />
      <Line left="Riya" right="$54.50" />
      <Line left="Adds up to" right="$163.50" tone="mint" strong />
    </View>
  );
}

function Offline() {
  return (
    <View className="gap-2">
      <View className="rounded-xl bg-site-amber-tint px-3.5 py-2.5"><Text variant="body-small" tone="site-amber" className="text-sm">Offline. 2 changes waiting.</Text></View>
      <View className="flex-row justify-between rounded-xl bg-site-chip px-3.5 py-2.5"><Text variant="body-small" tone="site-text" className="text-sm">Brunch · $54.00</Text><Text variant="body-small" tone="site-amber" className="text-sm">waiting</Text></View>
      <View className="flex-row justify-between rounded-xl bg-site-chip px-3.5 py-2.5"><Text variant="body-small" tone="site-text" className="text-sm">Taxi · $54.00</Text><Text variant="body-small" tone="mint" className="text-sm">synced</Text></View>
    </View>
  );
}

function Facts({ rows }: { rows: [string, string, ('site-text' | 'site-amber' | 'mint')?][] }) {
  return (
    <View className="gap-1">
      {rows.map(([left, right, tone]) => (
        <View key={left} className="flex-row justify-between gap-3">
          <Text variant="body-small" tone="site-muted" className="text-sm leading-7">{left}</Text>
          <Text variant="body-small" tone={tone ?? 'site-text'} className="text-sm leading-7">{right}</Text>
        </View>
      ))}
    </View>
  );
}

function Step({ n, title, body, desktop }: { n: string; title: string; body: string; desktop: boolean }) {
  return (
    <View className={`flex-1 border-t pt-[22px] ${RULE}`}>
      <Text variant="body-small" tone="mint" className="text-sm">{n}</Text>
      <Text accessibilityRole="header" tone="site-text" className="mt-3 font-semibold" style={{ fontSize: desktop ? 24 : 22, ...tight(desktop ? 24 : 22, 0.03) }}>{title}</Text>
      <Text tone="site-muted" className="mt-2 text-[15px] leading-[22px]">{body}</Text>
    </View>
  );
}

export function Landing({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { width } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const spots = useRef<Partial<Record<Anchor, number>>>({});
  const mark = (anchor: Anchor) => ({ onLayout: (e: { nativeEvent: { layout: { y: number } } }) => { spots.current[anchor] = e.nativeEvent.layout.y; } });
  const jump = (anchor: Anchor) => scroll.current?.scrollTo({ y: Math.max(0, (spots.current[anchor] ?? 0) - 12), animated: true });
  const go = (path: Path) => router.push(path);
  const start = (): Path => (signedIn ? '/home' : '/create-account');
  const edge = desktop ? 'px-16' : 'px-5';
  const stageScale = Math.min(1, (width - 128) / 1152);

  const nav = (
    <View className={`flex-row items-center justify-between border-b ${RULE} ${edge}`} style={{ height: desktop ? 72 : 60 }}>
      <View className="flex-row items-center gap-2.5">
        <BrandMark size={desktop ? 34 : 28} />
        <Text accessibilityRole="header" aria-label="CommonTab" tone="site-text" style={{ fontSize: desktop ? 18 : 17, ...tight(desktop ? 18 : 17) }}>
          <Text tone="site-text" className="font-bold" style={{ fontSize: desktop ? 18 : 17 }}>Common</Text>
          <Text tone="site-text" className="font-normal" style={{ fontSize: desktop ? 18 : 17 }}>Tab</Text>
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: desktop ? 30 : 12 }}>
        {desktop ? (
          <>
            {([['Product', 'product'], ['How it works', 'how'], ['Download', 'download']] as const).map(([label, anchor]) => (
              <Pressable key={anchor} accessibilityRole="link" accessibilityLabel={label} onPress={() => jump(anchor)} className="min-h-touch justify-center active:opacity-80">
                <Text variant="body-small" tone="site-muted" className="text-sm">{label}</Text>
              </Pressable>
            ))}
            {signedIn ? null : (
              <Pressable accessibilityRole="link" accessibilityLabel="Sign in" onPress={() => go('/sign-in')} className="min-h-touch justify-center active:opacity-80">
                <Text variant="body-small" tone="site-text" className="text-sm">Sign in</Text>
              </Pressable>
            )}
          </>
        ) : null}
        {signedIn || desktop ? (
          <Button label={signedIn ? 'Open app' : 'Get started'} variant="mint" size="small" className="min-h-[38px] px-[19px]" onPress={() => go(start())} />
        ) : (
          <Button label="Sign in" variant="mint" size="small" className="min-h-9 px-[18px]" onPress={() => go('/sign-in')} />
        )}
      </View>
    </View>
  );

  const stage = desktop ? (
    <View style={{ height: 640 * stageScale, marginTop: 56 }}>
      <View style={{ width: 1152, height: 640, transform: [{ scale: stageScale }], transformOrigin: 'top left' } as never}>
        <View style={{ position: 'absolute', left: 110, top: 70 }}><PhoneFrame width={270} height={553} radius={43} pad={9} rotate={-5}><GroupScreen /></PhoneFrame></View>
        <View style={{ position: 'absolute', left: 400, top: 0, zIndex: 2 }}><PhoneFrame width={320} height={656} radius={51} pad={11}><OverviewScreen /></PhoneFrame></View>
        <View style={{ position: 'absolute', left: 720, top: 70 }}><PhoneFrame width={270} height={553} radius={43} pad={9} rotate={5}><OfflineScreen /></PhoneFrame></View>
        <View className={`absolute z-[3] rounded-[18px] border bg-site-chip px-5 py-4 ${RULE}`} style={{ left: 1000, top: 110, width: 240, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' } as never}>
          <Text tone="site-muted" className="text-[13px]">Dinner at Uchi · $163.50</Text>
          <Text tone="site-text" className="font-semibold" style={{ fontSize: 30, ...tight(30, 0.03) }}>$54.50 each</Text>
          <Text tone="mint" className="text-[13px]">Every cent adds up</Text>
        </View>
      </View>
    </View>
  ) : (
    <View className="items-center" style={{ marginTop: 36 }}>
      <PhoneFrame width={250} height={512} radius={40} pad={8}><OverviewScreen k={0.8} /></PhoneFrame>
    </View>
  );

  return (
    <View className="flex-1 bg-site-bg">
      <ScrollView ref={scroll} className="flex-1" contentContainerClassName="items-center">
        <View className="w-full max-w-[1280px]">
          {nav}
          <View className={`overflow-hidden ${edge}`} style={{ paddingTop: desktop ? 96 : 44 }}>
            <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: desktop ? 24 : 156, width: desktop ? 900 : 500, height: desktop ? 700 : 500, marginLeft: desktop ? -450 : -250, backgroundImage: 'radial-gradient(closest-side, rgba(143,229,199,0.20), rgba(143,229,199,0) 70%)' } as never} />
            <View className="gap-[18px]" style={{ maxWidth: desktop ? 820 : undefined, gap: desktop ? 26 : 18 }}>
              <Text accessibilityRole="header" aria-level={1} tone="site-text" className="font-semibold" style={{ fontSize: desktop ? 84 : 46, lineHeight: desktop ? 82 : 46, ...tight(desktop ? 84 : 46, 0.045) }}>Nobody should do bill math twice.</Text>
              <Text tone="site-muted" style={{ fontSize: desktop ? 21 : 17, lineHeight: desktop ? 31 : 25.5, maxWidth: 560 }}>CommonTab splits every bill to the cent, keeps the balances, and works when your signal doesn't.</Text>
              <View className="flex-row flex-wrap gap-3" style={{ marginTop: desktop ? 6 : 0 }}>
                <Button label={signedIn ? 'Open the app' : 'Get started free'} variant="mint" className="px-[26px]" onPress={() => go(start())} />
                {desktop ? <Button label="See how it works" variant="hero-outline" className="px-[26px]" onPress={() => jump('how')} /> : null}
              </View>
            </View>
            {stage}
          </View>

          <View {...mark('product')} className={edge} style={{ paddingTop: desktop ? 120 : 64 }}>
            <Heading size={desktop ? 52 : 34} style={{ maxWidth: 760 }}>Built for the dull parts of splitting.</Heading>
            <View className="gap-4" style={{ marginTop: desktop ? 48 : 24 }}>
              <View className="gap-4" style={{ flexDirection: desktop ? 'row' : 'column' }}>
                <FeatureCard desktop={desktop} flex={680} minHeight={desktop ? 440 : undefined} title="Splits that add up exactly" body={desktop ? 'Money is stored in whole cents, so a share is never off by a penny. Equal, exact, percent, or item by item.' : 'Whole cents, so a share is never off by a penny.'}><Split /></FeatureCard>
                <FeatureCard desktop={desktop} flex={472} minHeight={desktop ? 440 : undefined} title="Keeps working offline" body={desktop ? 'Everything saves on your phone first and syncs when you reconnect. If two people edit the same expense, you choose which version stays.' : 'Saves on your phone first and syncs when you reconnect.'}><Offline /></FeatureCard>
              </View>
              <View className="gap-4" style={{ flexDirection: desktop ? 'row' : 'column' }}>
                <FeatureCard desktop={desktop} flex={360} minHeight={desktop ? 320 : undefined} title="Any currency" body="Add an expense in euros to a dollar group. The rate is saved with it.">
                  <Facts rows={[['Hotel', '€120.00'], ['Rate', '1 EUR = 1.08 USD'], ['Counts as', '$129.60', 'mint']]} />
                </FeatureCard>
                <FeatureCard desktop={desktop} flex={360} minHeight={desktop ? 320 : undefined} title="Fewer payments" body="Simplify a group into the smallest set of payments.">
                  <View className="gap-1">
                    <Text variant="body-small" tone="site-muted" className="text-sm leading-7"><Text variant="body-small" tone="site-muted" className="text-sm" style={{ textDecorationLine: 'line-through' }}>4 payments</Text>{'  '}<Text variant="body-small" tone="mint" className="text-sm font-semibold">2 payments</Text></Text>
                    <Text variant="body-small" tone="site-muted" className="text-sm leading-7">Jordan pays You $40.00</Text>
                    <Text variant="body-small" tone="site-muted" className="text-sm leading-7">Sam pays You $5.00</Text>
                  </View>
                </FeatureCard>
                <FeatureCard desktop={desktop} flex={412} minHeight={desktop ? 320 : undefined} title="One account, every device" body="Sign in anywhere and your groups are there.">
                  <View className="flex-row gap-2.5"><Chip label="iPhone" /><Chip label="Android" /><Chip label="Web" /></View>
                </FeatureCard>
              </View>
            </View>
          </View>

          <View {...mark('how')} className={edge} style={{ paddingTop: desktop ? 120 : 64 }}>
            <Heading size={desktop ? 52 : 34}>Make a group. Add a bill. Settle up.</Heading>
            <View className="gap-8" style={{ flexDirection: desktop ? 'row' : 'column', marginTop: desktop ? 48 : 28 }}>
              <Step desktop={desktop} n="1" title="Start a group" body="A trip, an apartment, a dinner crew. Invite people with a code." />
              <Step desktop={desktop} n="2" title="Add what you spend" body="Works on a plane. It syncs when you land." />
              <Step desktop={desktop} n="3" title="Settle up" body="Record a payment and the balance clears for everyone." />
            </View>
          </View>

          <View {...mark('download')} className={edge} style={{ paddingTop: desktop ? 120 : 64 }}>
            <View className={`overflow-hidden rounded-[36px] border bg-site-card ${RULE} ${desktop ? 'flex-row items-center justify-between p-[72px]' : 'gap-6 p-7'}`} style={{ backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(143,229,199,0.16), #0C2A33 60%)' } as never}>
              <Text accessibilityRole="header" tone="site-text" className="font-semibold" style={{ fontSize: desktop ? 56 : 38, lineHeight: desktop ? 56 : 38, ...tight(desktop ? 56 : 38, 0.045) }}>{'The next tab is\nalready split.'}</Text>
              <Button label={signedIn ? 'Open the app' : 'Get started free'} variant="mint" className="self-start px-[26px]" onPress={() => go(start())} />
            </View>
          </View>

          <View className={`flex-row flex-wrap items-center justify-between gap-3 ${edge}`} style={{ paddingVertical: desktop ? 56 : 40, marginTop: desktop ? 0 : 8 }}>
            <Text variant="body-small" tone="site-text" className="font-semibold">CommonTab</Text>
            <Text variant="body-small" tone="site-muted" className="text-[13px]">Privacy   Terms   © 2026 CommonTab</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
