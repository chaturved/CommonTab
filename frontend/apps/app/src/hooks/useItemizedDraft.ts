import { useState } from 'react';
import type { ItemRow } from '@commontab/core';

export interface ItemizedDraft {
  items: ItemRow[];
  taxText: string;
  tipPercent: string;
}

export const newItemRow = (): ItemRow => ({ name: '', priceText: '', assignedTo: [] });

export function useItemizedDraft() {
  return useState<ItemizedDraft>(() => ({ items: [newItemRow()], taxText: '', tipPercent: '' }));
}
