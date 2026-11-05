import { summarizeGroup } from '@commontab/core';
import type { Services } from '@/services/createServices';
import type { GroupData } from '@/types/group';
import { useLiveQuery } from '@/hooks/useLiveQuery';

const NO_GROUPS: GroupData[] = [];

async function loadGroups({ storage }: Services): Promise<GroupData[]> {
  const groups = await storage.listGroups();
  return Promise.all(groups.map(async (group) => {
    const [expenses, settlements] = await Promise.all([storage.listExpenses(group.id), storage.listSettlements(group.id)]);
    return { group, expenses, settlements, summary: summarizeGroup(group, expenses, settlements) };
  }));
}

export function useGroups(): { ready: boolean; groups: GroupData[] } {
  const { ready, value } = useLiveQuery(loadGroups, NO_GROUPS);
  return { ready, groups: value };
}

export function useGroup(id: string | undefined): { ready: boolean; data: GroupData | undefined } {
  const { ready, groups } = useGroups();
  return { ready, data: groups.find((g) => g.group.id === id) };
}
