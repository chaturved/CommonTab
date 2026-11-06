import { useState } from 'react';
import { decimalOnly } from '@/lib/amountInput';
import { TextInput, View } from 'react-native';
import { parseRate, rateSentence, shortDate, type RateResult } from '@commontab/core';
import { Banner, Button, Text, useThemeColors } from '@commontab/ui';

export function ForeignRate({ entry, currency, rateText, onRateText, quote, loading, kept, countsAs, error, compact }: {
  entry: string;
  currency: string;
  rateText: string;
  onRateText: (text: string) => void;
  quote: RateResult | null;
  loading: boolean;
  kept: boolean;
  countsAs: string | null;
  error?: string;
  compact?: boolean;
}) {
  const colors = useThemeColors();
  const [editing, setEditing] = useState(false);
  const micros = parseRate(rateText);
  const open = editing || (!loading && quote === null && !kept);
  const when = quote ? shortDate(`${quote.date}T12:00:00Z`) : null;

  const sentence = micros ? rateSentence(entry, currency, micros) : loading ? 'Getting the rate…' : 'No rate yet';

  return (
    <View className={compact ? 'mt-1 gap-2 border-t border-divider pt-2' : 'gap-2 rounded-card bg-card px-4 py-3'}>
      {compact ? (
        <View className="min-h-touch flex-row flex-wrap items-center gap-x-4 gap-y-1">
          <View className="min-w-0 flex-1 flex-row flex-wrap items-baseline gap-x-3">
            <Text variant="body-small" className="font-semibold" accessibilityLabel={micros ? `Rate, ${sentence}` : 'Rate, none yet'}>{sentence}</Text>
            {when && quote?.fresh ? <Text variant="caption" tone="muted">Rate from {when}</Text> : null}
          </View>
          {countsAs ? (
            <Text variant="body-small" tone="muted" accessibilityLabel={`Counts as ${countsAs}`}>Counts as <Text variant="body-small" className="font-bold">{countsAs}</Text></Text>
          ) : null}
          <Button label={open ? 'Done' : 'Edit'} variant="ghost" size="small" accessibilityLabel={open ? 'Done editing rate' : 'Edit rate'} onPress={() => setEditing(!open)} />
        </View>
      ) : (
      <View className="min-h-touch flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="caption" tone="muted" className="text-[13px] font-bold">Rate</Text>
          <Text variant="body" className="font-semibold" accessibilityLabel={micros ? `Rate, ${rateSentence(entry, currency, micros)}` : 'Rate, none yet'}>
            {micros ? rateSentence(entry, currency, micros) : loading ? 'Getting the rate…' : 'No rate yet'}
          </Text>
        </View>
        <Button label={open ? 'Done' : 'Edit'} variant="ghost" size="small" accessibilityLabel={open ? 'Done editing rate' : 'Edit rate'} onPress={() => setEditing(!open)} />
      </View>
      )}
      {open ? (
        <View className="gap-1">
          <TextInput
            accessibilityLabel={`Rate in ${currency} for 1 ${entry}`}
            value={rateText}
            onChangeText={(text) => onRateText(decimalOnly(text))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            className="h-12 rounded-input border bg-background px-4 text-[16px] text-fg"
            style={{ borderColor: colors['field-border'], outlineStyle: 'none' } as never}
          />
          {error ? <Text variant="caption" tone="owe">{error}</Text> : null}
        </View>
      ) : null}
      {compact && !open ? null : (
        <Text variant="caption" tone="muted" className="text-[13px] leading-[18px]">
          {when && quote?.fresh ? `Rate from ${when}. ` : ''}It is saved with this expense, so balances don't change if the rate moves later.
        </Text>
      )}
      {countsAs && !compact ? (
        <View className="min-h-touch flex-row items-center justify-between">
          <Text variant="body" tone="muted">Counts as</Text>
          <Text variant="button" accessibilityLabel={`Counts as ${countsAs}`}>{countsAs}</Text>
        </View>
      ) : null}
      {!loading && quote && !quote.fresh && when ? (
        <Banner tone="warning" message={`You're offline, so this rate is from your last sync (${when}). It will be kept as is.`} />
      ) : null}
      {!loading && quote === null && !kept ? <Banner tone="warning" message={`No saved rate for ${entry} yet. Enter one to save this expense.`} /> : null}
    </View>
  );
}
