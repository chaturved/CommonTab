import { useEffect, useState } from 'react';
import { quoteRate, type RateResult } from '@commontab/core';
import { useApp } from '@/context/AppContext';

export function useRateQuote(entry: string, currency: string, enabled: boolean, onQuote: (result: RateResult | null) => void) {
  const { services } = useApp();
  const key = `${entry}:${currency}`;
  const [settled, setSettled] = useState<{ key: string; quote: RateResult | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void quoteRate(services.api, services.storage, entry, currency).then((quote) => {
      if (!live) return;
      setSettled({ key, quote });
      onQuote(quote);
    });
    return () => {
      live = false;
    };
  }, [services, entry, currency, enabled, key, onQuote]);

  const current = enabled && settled?.key === key;
  return { quote: current ? settled.quote : null, quoting: enabled && !current };
}
