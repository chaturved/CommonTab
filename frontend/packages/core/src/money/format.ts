import { formatMinorUnits } from './money';

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', KRW: '₩', CAD: 'CA$', AUD: 'A$', MXN: 'MX$', NZD: 'NZ$', CNY: 'CN¥',
};

export function formatCurrency(units: number, currencyCode: string): string {
  const plain = formatMinorUnits(units, currencyCode);
  const [whole = '0', fraction] = plain.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const number = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  const symbol = SYMBOLS[currencyCode];
  return symbol ? `${symbol}${number}` : `${currencyCode} ${number}`;
}
