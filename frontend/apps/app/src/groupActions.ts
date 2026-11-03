import { useCallback, useState } from 'react';
import { ApiError } from '@commontab/core';
import { useApp } from './app-context';

export type ActionResult = { ok: true } | { ok: false; blockedBalance?: number; message: string };

function explain(error: unknown): ActionResult {
  if (error instanceof ApiError) {
    if (error.isNetwork) return { ok: false, message: 'This needs an internet connection. Try again when you are back online.' };
    if (error.code === 'owes_balance') return { ok: false, blockedBalance: error.balanceMinor ?? 0, message: 'Settle up before leaving.' };
    if (error.code === 'not_settled') return { ok: false, message: 'Everyone needs to be settled up first.' };
    if (error.code === 'not_owner') return { ok: false, message: 'Only the group owner can do this.' };
    if (error.code === 'last_account') return { ok: false, message: 'You are the only person with an account here. Delete the group instead.' };
    if (error.status === 404) return { ok: false, message: 'This group is no longer available to you.' };
    if (error.status >= 500 || error.status === 429) return { ok: false, message: "CommonTab can't do that right now. Try again in a moment." };
  }
  return { ok: false, message: 'Something went wrong. Try again.' };
}

export function useGroupActions(groupId: string) {
  const { services } = useApp();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (work: () => Promise<void>): Promise<ActionResult> => {
    setBusy(true);
    try {
      await work();
      return { ok: true };
    } catch (error) {
      return explain(error);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    busy,
    leave: () => run(async () => {
      await services.api.leaveGroup(groupId);
      await services.engine.sync();
    }),
    removeMember: (memberId: string) => run(async () => {
      await services.api.removeMember(groupId, memberId);
      await services.engine.sync();
    }),
    archive: () => run(async () => {
      await services.api.archiveGroup(groupId);
      await services.engine.sync();
    }),
    unarchive: () => run(async () => {
      await services.api.unarchiveGroup(groupId);
      await services.engine.sync();
    }),
    deleteGroup: () => run(async () => {
      await services.api.deleteGroup(groupId);
      await services.actions.deleteLocalGroup(groupId);
    }),
    deleteLocalCopy: () => run(() => services.actions.deleteLocalGroup(groupId)),
  };
}
