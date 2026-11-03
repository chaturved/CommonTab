import { View } from 'react-native';
import { formatCurrency } from '@commontab/core';
import { Hero, Text } from '@commontab/ui';
import { useIsDesktop } from '../layout';

export function heroLabel(net: number, scope: 'overall' | 'group'): string {
  if (net > 0) return scope === 'overall' ? "YOU'RE OWED OVERALL" : "YOU'RE OWED";
  if (net < 0) return scope === 'overall' ? 'YOU OWE OVERALL' : 'YOU OWE';
  return scope === 'overall' ? "YOU'RE ALL SETTLED UP" : "YOU'RE SETTLED UP";
}

export function BalanceHero({ net, currencyCode, scope, caption, owe, owed }: {
  net: number;
  currencyCode: string;
  scope: 'overall' | 'group';
  caption?: string;
  owe?: number;
  owed?: number;
}) {
  const desktop = useIsDesktop();
  const amount = formatCurrency(Math.abs(net), currencyCode);
  const headline = (
    <View className="gap-1" importantForAccessibility="no-hide-descendants">
      <Text variant="label" tone="mint">{heroLabel(net, scope)}</Text>
      <Text variant="balance" tone="white" style={desktop ? { fontSize: 56, lineHeight: 62 } : undefined}>{amount}</Text>
      {caption ? <Text variant="caption" tone="hero-muted" className="text-[13px]">{caption}</Text> : null}
    </View>
  );
  const stats = owe !== undefined && owed !== undefined ? (
    <View className={desktop ? 'w-[440px] flex-row gap-3' : 'flex-row gap-2.5'} importantForAccessibility="no-hide-descendants">
      <Stat label="You owe" value={formatCurrency(owe, currencyCode)} large={desktop} />
      <Stat label="Owed to you" value={formatCurrency(owed, currencyCode)} large={desktop} />
    </View>
  ) : null;
  return (
    <Hero accessible accessibilityLabel={`${heroLabel(net, scope).toLowerCase()} ${amount}${caption ? `. ${caption}` : ''}`} padding={desktop ? 28 : 20}>
      {desktop ? (
        <View className="flex-row items-center justify-between gap-10">
          {headline}
          {stats}
        </View>
      ) : (
        <>
          {headline}
          {stats}
        </>
      )}
    </Hero>
  );
}

function Stat({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <View className="flex-1 gap-0.5 rounded-2xl px-3.5 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
      <Text variant="caption" tone="hero-muted">{label}</Text>
      <Text variant="button" tone="white" style={large ? { fontSize: 24, lineHeight: 30 } : undefined}>{value}</Text>
    </View>
  );
}
