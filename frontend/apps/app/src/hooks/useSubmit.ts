import { useCallback, useState } from 'react';
import { describeAuthFailure, type AuthAction, type AuthFailure } from '@commontab/core';

export function useSubmit(action: AuthAction) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);

  const run = useCallback(async (work: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setFailure(null);
    try {
      await work();
      return true;
    } catch (error) {
      setFailure(describeAuthFailure(error, action));
      return false;
    } finally {
      setBusy(false);
    }
  }, [action]);

  return { busy, failure, run, clear: () => setFailure(null) };
}
