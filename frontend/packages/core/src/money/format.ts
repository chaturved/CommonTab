import { formatMinorUnits } from './money';

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', KRW: '₩', CAD: 'CA$', AUD: 'A$', MXN: 'MX$', NZD: 'NZ$', CNY: 'CN¥',
};

/**
 * Display text for an amount, en-US style: "$1,234.56", "¥1,234", "CHF 1,234.50".
 * Integer-only. Takes a non-negative amount; callers add any sign or wording ("you owe").
 */
export function formatCurrency(units: number, currencyCode: string): string {
  const plain = formatMinorUnits(units, currencyCode);
  const [whole = '0', fraction] = plain.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const number = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  const symbol = SYMBOLS[currencyCode];
  return symbol ? `${symbol}${number}` : `${currencyCode} ${number}`;
}
