import { useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import type { ExpenseForm, FormEvaluation, LocalGroup, Member } from '@commontab/core';
import { resetItemizedSplit } from '@/state/itemizedSplit';

export interface ExpenseDraft {
  mode: 'add' | 'edit';
  form: ExpenseForm;
  setForm: Dispatch<SetStateAction<ExpenseForm>>;
  patch: (changes: Partial<ExpenseForm>) => void;
  evaluated: FormEvaluation;
  group: LocalGroup;
  people: Member[];
  memberIds: string[];
  note: string | null;
}

interface State {
  draft: ExpenseDraft | null;
  byItem: boolean;
}

let state: State = { draft: null, byItem: false };
const listeners = new Set<() => void>();

function update(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const publishExpenseDraft = (draft: ExpenseDraft) => update({ ...state, draft });
export const setSplitByItem = (byItem: boolean) => update({ ...state, byItem });

export function clearExpenseDraft() {
  resetItemizedSplit();
  update({ draft: null, byItem: false });
}

export function useExpenseDraft(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
