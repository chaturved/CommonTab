import { useState } from 'react';
import { decimalOnly } from '@/lib/amountInput';
import { TextInput, View } from 'react-native';
import { parseRate, rateSentence, shortDate, type RateResult } from '@commontab/core';
import { Banner, Button, Text, useThemeColors } from '@commontab/ui';

export function ForeignRate({ entry, currency, rateText, onRateText, quote, loading, kept, countsAs, error }: {
  entry: string;
  currency: string;
  rateText: string;
  onRateText: (text: string) => void;
  quote: RateResult | null;
  loading: boolean;
  kept: boolean;
  countsAs: string | null;
  error?: string;
}) {
  const colors = useThemeColors();
  const [editing, setEditing] = useState(false);
  const micros = parseRate(rateText);
  const open = editing || (!loading && quote === null && !kept);
  const when = quote ? shortDate(`${quote.date}T12:00:00Z`) : null;

  return (
    <View className="gap-2 rounded-card bg-card px-4 py-3">
      <View className="min-h-touch flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="caption" tone="muted" className="text-[13px] font-bold">Rate</Text>
          <Text variant="body" className="font-semibold" accessibilityLabel={micros ? `Rate, ${rateSentence(entry, currency, micros)}` : 'Rate, none yet'}>
            {micros ? rateSentence(entry, currency, micros) : loading ? 'Getting the rate…' : 'No rate yet'}
          </Text>
        </View>
        <Button label={open ? 'Done' : 'Edit'} variant="ghost" size="small" accessibilityLabel={open ? 'Done editing rate' : 'Edit rate'} onPress={() => setEditing(!open)} />
      </View>
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
      <Text variant="caption" tone="muted" className="text-[13px] leading-[18px]">
        {when && quote?.fresh ? `Rate from ${when}. ` : ''}It is saved with this expense, so balances don't change if the rate moves later.
      </Text>
      {countsAs ? (
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
