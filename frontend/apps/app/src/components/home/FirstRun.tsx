import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { Button, Card, Hero, Icon, Text } from '@commontab/ui';
import { SectionHeader } from '@/components/ui/Section';
import { useIsDesktop } from '@/hooks/useViewport';

const STEPS = [
  ['Create a group', 'A trip, an apartment, a dinner crew'],
  ['Add expenses', 'Split equally, by amount, or by percent'],
  ['Settle up', 'Record payments to clear balances'],
] as const;

export function FirstRun({ name }: { name: string }) {
  const router = useRouter();
  const desktop = useIsDesktop();

  const create = <Button label="Create a group" variant="hero" icon={<Icon icon={Plus} size={20} strokeWidth={2.4} tone="hero-to" />} onPress={() => router.push('/groups/new')} />;
  const join = <Button label="Join with a code" variant="hero-outline" onPress={() => router.push('/groups/join')} />;

  const welcome = (
    <Hero padding={desktop ? 32 : 20} className={desktop ? 'flex-[1.3]' : undefined}>
      <Text variant="label" tone="mint">Welcome, {name}</Text>
      <Text variant="large-title" tone="white" className="text-[26px] leading-[30px]">Split costs without the awkward math.</Text>
      <Text variant="body-small" tone="hero-muted" className="max-w-[440px] text-sm leading-5">
        Make a group, add what you spend, and CommonTab keeps track of who owes who.
      </Text>
      {desktop ? <View className="mt-2 flex-row flex-wrap gap-3">{create}{join}</View> : <>{create}{join}</>}
    </Hero>
  );

  const steps = (
    <Card className={desktop ? 'flex-1 p-6' : 'overflow-hidden'}>
      {desktop ? <Text variant="section" accessibilityRole="header" className="pb-2">How it works</Text> : null}
      {STEPS.map(([title, body], index) => (
        <View key={title} accessible accessibilityLabel={`Step ${index + 1}: ${title}. ${body}`} className={`min-h-row flex-row items-center gap-3.5 py-3 ${desktop ? '' : 'px-4'} ${index < STEPS.length - 1 ? 'border-b border-divider' : ''}`}>
          <View className="h-8 w-8 items-center justify-center rounded-pill bg-tint">
            <Text variant="caption" tone="on-tint" className="font-bold">{index + 1}</Text>
          </View>
          <View className="flex-1">
            <Text variant="body" className="font-semibold">{title}</Text>
            <Text variant="caption" tone="muted" className="text-[13px]">{body}</Text>
          </View>
        </View>
      ))}
    </Card>
  );

  if (desktop) {
    return <View className="w-full max-w-[960px] flex-row items-stretch gap-6 self-start">{welcome}{steps}</View>;
  }
  return (
    <>
      {welcome}
      <SectionHeader title="How it works" />
      {steps}
    </>
  );
}
