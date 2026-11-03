import { View } from 'react-native';
import { formatCurrency } from '@commontab/core';
import { cx } from '../theme';
import { Text, TextTone } from './Text';

export interface AmountTextProps {
  /** Signed minor units. For `balance`: positive means you are owed, negative means you owe. */
  minorUnits: number;
  currency: string;
  /**
   * `balance` shows the direction in words ("you owe", "you're owed", "settled up") as well as color,
   * so money is never conveyed by color alone. `plain` is an expense amount: no direction, neutral color.
   */
  kind?: 'balance' | 'plain';
  /** `stacked` puts the words above the amount (list rows); `inline` puts them before it. */
  layout?: 'stacked' | 'inline';
  className?: string;
}

export function balanceWords(minorUnits: number): 'you owe' | "you're owed" | 'settled up' {
  return minorUnits < 0 ? 'you owe' : minorUnits > 0 ? "you're owed" : 'settled up';
}

export function AmountText({ minorUnits, currency, kind = 'balance', layout = 'stacked', className }: AmountTextProps) {
  const amount = formatCurrency(Math.abs(minorUnits), currency);
  if (kind === 'plain') {
    return (
      <Text variant="button" accessibilityLabel={amount} className={className}>
        {amount}
      </Text>
    );
  }
  const words = balanceWords(minorUnits);
  const tone: TextTone = minorUnits < 0 ? 'owe' : minorUnits > 0 ? 'accent' : 'muted';
  const spoken = minorUnits === 0 ? `settled up, ${amount}` : `${words} ${amount}`;
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      className={cx(layout === 'stacked' ? 'items-end gap-0.5' : 'flex-row items-baseline gap-1.5', className)}
    >
      <Text variant="caption" tone="muted">
        {words}
      </Text>
      <Text variant="button" tone={tone}>
        {amount}
      </Text>
    </View>
  );
}
