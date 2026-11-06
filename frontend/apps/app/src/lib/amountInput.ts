import { formatCurrency } from '@commontab/core';

export const decimalOnly = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

export const currencySymbol = (currencyCode: string) => formatCurrency(0, currencyCode).replace(/[\d.,\s]+$/, '').trim();
