import { useCallback, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { explainGroupError, type ActionResult } from '@/lib/groupErrors';

export function useGroupActions(groupId: string) {
  const { services } = useApp();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (work: () => Promise<void>): Promise<ActionResult> => {
    setBusy(true);
    try {
      await work();
      return { ok: true };
    } catch (error) {
      return explainGroupError(error);
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
