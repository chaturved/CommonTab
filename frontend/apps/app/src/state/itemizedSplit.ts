import { useSyncExternalStore, type SetStateAction } from 'react';
import { newItemRow, type ItemizedDraft } from '@/hooks/useItemizedDraft';

const initial = (): ItemizedDraft => ({ items: [newItemRow()], taxText: '', tipPercent: '' });

let draft = initial();
const draftListeners = new Set<() => void>();

const subscribeDraft = (listener: () => void) => {
  draftListeners.add(listener);
  return () => { draftListeners.delete(listener); };
};

function setDraft(next: SetStateAction<ItemizedDraft>) {
  draft = typeof next === 'function' ? next(draft) : next;
  draftListeners.forEach((listener) => listener());
}

export function useItemizedSplitDraft() {
  return [useSyncExternalStore(subscribeDraft, () => draft, () => draft), setDraft] as const;
}

export function resetItemizedSplit() {
  setDraft(initial());
}
