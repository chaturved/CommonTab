import { View } from 'react-native';
import { formatCurrency } from '@commontab/core';
import { Hero, Text } from '@commontab/ui';

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
  const amount = formatCurrency(Math.abs(net), currencyCode);
  return (
    <Hero accessible accessibilityLabel={`${heroLabel(net, scope).toLowerCase()} ${amount}${caption ? `. ${caption}` : ''}`}>
      <View className="gap-1" importantForAccessibility="no-hide-descendants">
        <Text variant="label" tone="mint">{heroLabel(net, scope)}</Text>
        <Text variant="balance" tone="white">{amount}</Text>
        {caption ? <Text variant="caption" tone="hero-muted" className="text-[13px]">{caption}</Text> : null}
      </View>
      {owe !== undefined && owed !== undefined ? (
        <View className="flex-row gap-2.5" importantForAccessibility="no-hide-descendants">
          <Stat label="You owe" value={formatCurrency(owe, currencyCode)} />
          <Stat label="Owed to you" value={formatCurrency(owed, currencyCode)} />
        </View>
      ) : null}
    </Hero>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-2xl px-3.5 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
      <Text variant="caption" tone="hero-muted">{label}</Text>
      <Text variant="button" tone="white">{value}</Text>
    </View>
  );
}
