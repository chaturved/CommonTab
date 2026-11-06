import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  balanceChangeNote, balanceChanges, evaluateForm, formatRate, formFromExpense, newExpenseForm,
  type ExpenseForm, type LocalExpense, type RateResult,
} from '@commontab/core';
import { useApp } from '@/context/AppContext';
import { useRateQuote } from '@/hooks/useRateQuote';
import type { GroupData } from '@/types/group';

interface Options {
  mode: 'add' | 'edit';
  data: GroupData;
  expense?: LocalExpense;
  initial?: Partial<ExpenseForm>;
}

export function useExpenseForm({ mode, data, expense, initial }: Options) {
  const router = useRouter();
  const { services } = useApp();
  const { group } = data;
  const currency = group.currencyCode;
  const [form, setForm] = useState<ExpenseForm>(() => (expense ? formFromExpense(expense, currency) : { ...newExpenseForm(group, Date.now()), ...initial }));
  const [baseline] = useState(() => form);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const patch = useCallback((changes: Partial<ExpenseForm>) => setForm((f) => ({ ...f, ...changes })), []);
  const evaluated = useMemo(() => evaluateForm(form, currency), [form, currency]);

  const entry = form.currencyCode ?? currency;
  const foreign = entry !== currency;
  const keptRate = mode === 'edit' && expense?.currencyCode === entry;
  const fillRate = useCallback((result: RateResult | null) => {
    if (result) setForm((f) => (f.currencyCode === entry && f.rateText === '' ? { ...f, rateText: formatRate(result.rateMicros) } : f));
  }, [entry]);
  const { quote, quoting } = useRateQuote(entry, currency, foreign && !keptRate, fillRate);
  const pickCurrency = (code: string) => patch({ currencyCode: code === currency ? null : code, rateText: '' });

  const note = useMemo(() => {
    if (mode !== 'edit' || !expense || !evaluated.draft) return null;
    const before = { payerID: expense.payerID, amountMinor: expense.amountMinor, allocations: expense.allocations };
    const after = { payerID: evaluated.draft.payerID, amountMinor: evaluated.draft.amountMinor, allocations: evaluated.shares };
    return balanceChangeNote(balanceChanges(group, before, after), group.meMemberID, currency);
  }, [mode, expense, evaluated, group, currency]);

  const save = async () => {
    if (!evaluated.draft) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await services.actions.saveExpense(group.id, { ...evaluated.draft, id: expense?.id });
      void services.engine.sync();
      if (mode === 'edit') router.back();
      else router.replace({ pathname: '/groups/[id]', params: { id: saved.groupID } });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not save this expense.');
      setBusy(false);
    }
  };

  return { form, setForm, patch, evaluated, entry, foreign, keptRate, quote, quoting, pickCurrency, note, busy, problem, dirty, save };
}
