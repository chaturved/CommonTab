import type { GroupSummary, LocalExpense, LocalGroup, LocalSettlement } from '@commontab/core';

export interface GroupData {
  group: LocalGroup;
  expenses: LocalExpense[];
  settlements: LocalSettlement[];
  summary: GroupSummary;
}
