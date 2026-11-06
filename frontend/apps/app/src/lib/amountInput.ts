import { formatCurrency, formatMinorUnits, parseMinorUnits } from '@commontab/core';

export const decimalOnly = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

export const currencySymbol = (currencyCode: string) => formatCurrency(0, currencyCode).replace(/[\d.,\s]+$/, '').trim();

export const percentOnly = (text: string) => {
  const [whole = '', fraction] = decimalOnly(text).split('.');
  const limited = fraction === undefined ? whole : `${whole}.${fraction.slice(0, 2)}`;
  return Number(limited) > 100 ? '100' : limited;
};

export function capAmountText(text: string, maxMinor: number | null, currencyCode: string): string {
  const cleaned = decimalOnly(text);
  if (maxMinor === null) return cleaned;
  try {
    return parseMinorUnits(cleaned, currencyCode) > maxMinor ? formatMinorUnits(maxMinor, currencyCode) : cleaned;
  } catch {
    return cleaned;
  }
}
