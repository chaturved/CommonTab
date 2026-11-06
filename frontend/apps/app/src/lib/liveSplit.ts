import { parseMinorUnits, splitEqual } from '@commontab/core';

export interface LiveSplit {
  total: number;
  shares: number[];
}

export function liveSplit(text: string, people: number): LiveSplit {
  let total = 0;
  try {
    total = parseMinorUnits(text, 'USD');
  } catch {
    return { total: 0, shares: [] };
  }
  if (total === 0 || people < 1) return { total: 0, shares: [] };
  return { total, shares: splitEqual(total, people) };
}
