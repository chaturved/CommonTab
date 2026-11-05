import { useRef, type ComponentRef, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Text } from '@commontab/ui';
import { BrandMark } from '../components/BrandMark';
import { useViewportWidth } from '../layout';
import { GroupScreen, OfflineScreen, OverviewScreen, PhoneFrame } from './mocks';

type Anchor = 'product' | 'how' | 'download';
type Path = '/home' | '/sign-in' | '/create-account';

const RULE = 'border-site-line';
const CARD = `rounded-[28px] border ${RULE} bg-site-card`;
const EDGE = 'px-5 lg:px-16';
const tight = (size: number, em = 0.04) => ({ letterSpacing: -size * em });

const SECTION_HEADING = '!text-[34px] leading-[34.68px] tracking-[-1.36px] lg:!text-[52px] lg:leading-[53.04px] lg:tracking-[-2.08px]';

function Heading({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Text accessibilityRole="header" tone="site-text" className={`font-semibold ${SECTION_HEADING}`} style={style}>
      {children}
    </Text>
  );
}

function FeatureCard({ title, body, shortBody, children, flex, tall }: { title: string; body: string; shortBody?: string; children: ReactNode; flex?: number; tall?: 'lg:min-h-[320px]' | 'lg:min-h-[440px]' }) {
  return (
    <View className={`${CARD} justify-between gap-5 overflow-hidden p-6 lg:p-8 ${tall ?? ''}`} style={{ flex }}>
      <View className="gap-2.5">
        <Text accessibilityRole="header" tone="site-text" className="!text-[22px] font-semibold leading-[26px] tracking-[-0.66px] lg:!text-[26px] lg:leading-[30px] lg:tracking-[-0.78px]">{title}</Text>
        {shortBody ? (
          <>
            <View className="lg:hidden"><Text tone="site-muted" className="text-[15px] leading-[22px]" style={{ maxWidth: 420 }}>{shortBody}</Text></View>
            <View className="hidden lg:flex"><Text tone="site-muted" className="text-[15px] leading-[22px]" style={{ maxWidth: 420 }}>{body}</Text></View>
          </>
        ) : (
          <Text tone="site-muted" className="text-[15px] leading-[22px]" style={{ maxWidth: 420 }}>{body}</Text>
        )}
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

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View className={`flex-1 border-t pt-[22px] ${RULE}`}>
      <Text variant="body-small" tone="mint" className="text-sm">{n}</Text>
      <Text accessibilityRole="header" tone="site-text" className="mt-3 !text-[22px] font-semibold tracking-[-0.66px] lg:!text-[24px] lg:tracking-[-0.72px]">{title}</Text>
      <Text tone="site-muted" className="mt-2 text-[15px] leading-[22px]">{body}</Text>
    </View>
  );
}

export function Landing({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const width = useViewportWidth();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const spots = useRef<Partial<Record<Anchor, number>>>({});
  const mark = (anchor: Anchor) => ({ onLayout: (e: { nativeEvent: { layout: { y: number } } }) => { spots.current[anchor] = e.nativeEvent.layout.y; } });
  const jump = (anchor: Anchor) => scroll.current?.scrollTo({ y: Math.max(0, (spots.current[anchor] ?? 0) - 12), animated: true });
  const go = (path: Path) => router.push(path);
  const start = (): Path => (signedIn ? '/home' : '/create-account');
  const stageScale = Math.min(1, (width - 128) / 1152);

  const nav = (
    <View className={`h-[60px] flex-row items-center justify-between border-b lg:h-[72px] ${RULE} ${EDGE}`}>
      <View className="flex-row items-center gap-2.5">
        <View className="lg:hidden"><BrandMark size={28} /></View>
        <View className="hidden lg:flex"><BrandMark size={34} /></View>
        <Text accessibilityRole="header" aria-label="CommonTab" tone="site-text" className="!text-[17px] tracking-[-0.68px] lg:!text-[18px] lg:tracking-[-0.72px]">
          <Text tone="site-text" className="!text-[17px] font-bold lg:!text-[18px]">Common</Text>
          <Text tone="site-text" className="!text-[17px] font-normal lg:!text-[18px]">Tab</Text>
        </Text>
      </View>
      <View className="flex-row items-center gap-3 lg:gap-[30px]">
        <View className="hidden flex-row items-center gap-[30px] lg:flex">
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
        </View>
        {signedIn ? (
          <Button label="Open app" variant="mint" size="small" className="min-h-[38px] px-[19px]" onPress={() => go(start())} />
        ) : (
          <>
            <View className="lg:hidden"><Button label="Sign in" variant="mint" size="small" className="min-h-9 px-[18px]" onPress={() => go('/sign-in')} /></View>
            <View className="hidden lg:flex"><Button label="Get started" variant="mint" size="small" className="min-h-[38px] px-[19px]" onPress={() => go(start())} /></View>
          </>
        )}
      </View>
    </View>
  );

  const desktopStage = (
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
  );

  const phoneStage = (
    <View className="items-center" style={{ marginTop: 36 }}>
      <PhoneFrame width={250} height={512} radius={40} pad={8}><OverviewScreen k={0.8} /></PhoneFrame>
    </View>
  );

  return (
    <View className="flex-1 bg-site-bg">
      <ScrollView ref={scroll} className="flex-1" contentContainerClassName="items-center">
        <View className="w-full max-w-[1280px]">
          {nav}
          <View className={`overflow-hidden pt-11 lg:pt-24 ${EDGE}`}>
            <View pointerEvents="none" className="top-[156px] -ml-[250px] h-[500px] w-[500px] lg:top-6 lg:-ml-[450px] lg:h-[700px] lg:w-[900px]" style={{ position: 'absolute', left: '50%', backgroundImage: 'radial-gradient(closest-side, rgba(143,229,199,0.20), rgba(143,229,199,0) 70%)' } as never} />
            <View className="gap-[18px] lg:max-w-[820px] lg:gap-[26px]">
              <Text accessibilityRole="header" aria-level={1} tone="site-text" className="!text-[46px] font-semibold leading-[46px] tracking-[-2.07px] lg:!text-[84px] lg:leading-[82px] lg:tracking-[-3.78px]">Nobody should do bill math twice.</Text>
              <Text tone="site-muted" className="!text-[17px] leading-[25.5px] lg:!text-[21px] lg:leading-[31px]" style={{ maxWidth: 560 }}>CommonTab splits every bill to the cent, keeps the balances, and works when your signal doesn't.</Text>
              <View className="flex-row flex-wrap gap-3 lg:mt-1.5">
                <Button label={signedIn ? 'Open the app' : 'Get started free'} variant="mint" className="px-[26px]" onPress={() => go(start())} />
                <View className="hidden lg:flex"><Button label="See how it works" variant="hero-outline" className="px-[26px]" onPress={() => jump('how')} /></View>
              </View>
            </View>
            <View className="hidden lg:flex">{desktopStage}</View>
            <View className="lg:hidden">{phoneStage}</View>
          </View>

          <View {...mark('product')} className={`pt-16 lg:pt-[120px] ${EDGE}`}>
            <Heading style={{ maxWidth: 760 }}>Built for the dull parts of splitting.</Heading>
            <View className="mt-6 gap-4 lg:mt-12">
              <View className="flex-col gap-4 lg:flex-row">
                <FeatureCard flex={680} tall="lg:min-h-[440px]" title="Splits that add up exactly" body="Money is stored in whole cents, so a share is never off by a penny. Equal, exact, percent, or item by item." shortBody="Whole cents, so a share is never off by a penny."><Split /></FeatureCard>
                <FeatureCard flex={472} tall="lg:min-h-[440px]" title="Keeps working offline" body="Everything saves on your phone first and syncs when you reconnect. If two people edit the same expense, you choose which version stays." shortBody="Saves on your phone first and syncs when you reconnect."><Offline /></FeatureCard>
              </View>
              <View className="flex-col gap-4 lg:flex-row">
                <FeatureCard flex={360} tall="lg:min-h-[320px]" title="Any currency" body="Add an expense in euros to a dollar group. The rate is saved with it.">
                  <Facts rows={[['Hotel', '€120.00'], ['Rate', '1 EUR = 1.08 USD'], ['Counts as', '$129.60', 'mint']]} />
                </FeatureCard>
                <FeatureCard flex={360} tall="lg:min-h-[320px]" title="Fewer payments" body="Simplify a group into the smallest set of payments.">
                  <View className="gap-1">
                    <Text variant="body-small" tone="site-muted" className="text-sm leading-7"><Text variant="body-small" tone="site-muted" className="text-sm" style={{ textDecorationLine: 'line-through' }}>4 payments</Text>{'  '}<Text variant="body-small" tone="mint" className="text-sm font-semibold">2 payments</Text></Text>
                    <Text variant="body-small" tone="site-muted" className="text-sm leading-7">Jordan pays You $40.00</Text>
                    <Text variant="body-small" tone="site-muted" className="text-sm leading-7">Sam pays You $5.00</Text>
                  </View>
                </FeatureCard>
                <FeatureCard flex={412} tall="lg:min-h-[320px]" title="One account, every device" body="Sign in anywhere and your groups are there.">
                  <View className="flex-row gap-2.5"><Chip label="iPhone" /><Chip label="Android" /><Chip label="Web" /></View>
                </FeatureCard>
              </View>
            </View>
          </View>

          <View {...mark('how')} className={`pt-16 lg:pt-[120px] ${EDGE}`}>
            <Heading>Make a group. Add a bill. Settle up.</Heading>
            <View className="mt-7 flex-col gap-8 lg:mt-12 lg:flex-row">
              <Step n="1" title="Start a group" body="A trip, an apartment, a dinner crew. Invite people with a code." />
              <Step n="2" title="Add what you spend" body="Works on a plane. It syncs when you land." />
              <Step n="3" title="Settle up" body="Record a payment and the balance clears for everyone." />
            </View>
          </View>

          <View {...mark('download')} className={`pt-16 lg:pt-[120px] ${EDGE}`}>
            <View className={`gap-6 overflow-hidden rounded-[36px] border bg-site-card p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:p-[72px] ${RULE}`} style={{ backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(143,229,199,0.16), #0C2A33 60%)' } as never}>
              <Text accessibilityRole="header" tone="site-text" className="!text-[38px] font-semibold leading-[38px] tracking-[-1.71px] lg:!text-[56px] lg:leading-[56px] lg:tracking-[-2.52px]">{'The next tab is\nalready split.'}</Text>
              <Button label={signedIn ? 'Open the app' : 'Get started free'} variant="mint" className="self-start px-[26px]" onPress={() => go(start())} />
            </View>
          </View>

          <View className={`mt-2 flex-row flex-wrap items-center justify-between gap-3 py-10 lg:mt-0 lg:py-14 ${EDGE}`}>
            <Text variant="body-small" tone="site-text" className="font-semibold">CommonTab</Text>
            <Text variant="body-small" tone="site-muted" className="text-[13px]">Privacy   Terms   © 2026 CommonTab</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
