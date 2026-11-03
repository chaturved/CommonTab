import { useEffect, useState } from 'react';
import { summarizeGroup, type GroupSummary, type LocalExpense, type LocalGroup, type LocalSettlement } from '@commontab/core';
import { useApp } from './app-context';

export interface GroupData {
  group: LocalGroup;
  expenses: LocalExpense[];
  settlements: LocalSettlement[];
  summary: GroupSummary;
}

export function useGroups(): { ready: boolean; groups: GroupData[] } {
  const { services } = useApp();
  const [state, setState] = useState<{ ready: boolean; groups: GroupData[] }>({ ready: false, groups: [] });

  useEffect(() => {
    let live = true;
    const load = async () => {
      const groups = await services.storage.listGroups();
      const loaded = await Promise.all(groups.map(async (group) => {
        const [expenses, settlements] = await Promise.all([services.storage.listExpenses(group.id), services.storage.listSettlements(group.id)]);
        return { group, expenses, settlements, summary: summarizeGroup(group, expenses, settlements) };
      }));
      if (live) setState({ ready: true, groups: loaded });
    };
    void load();
    const unsubscribe = services.engine.subscribe(() => void load());
    return () => {
      live = false;
      unsubscribe();
    };
  }, [services]);

  return state;
}

export function useGroup(id: string | undefined): { ready: boolean; data: GroupData | undefined } {
  const { ready, groups } = useGroups();
  return { ready, data: groups.find((g) => g.group.id === id) };
}
