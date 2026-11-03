const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** Minor-unit digits for an ISO 4217 code, or undefined if the code is not three capital letters. */
export function fractionDigits(currencyCode: string): 0 | 2 | 3 | undefined {
  if (!/^[A-Z]{3}$/.test(currencyCode)) return undefined;
  if (ZERO_DECIMAL.has(currencyCode)) return 0;
  if (THREE_DECIMAL.has(currencyCode)) return 3;
  return 2;
}
