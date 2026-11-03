import { useEffect, useState } from 'react';
import type { SyncStatus } from '@commontab/core';
import { useApp } from './app-context';

export function useSyncStatus(): SyncStatus | null {
  const { services } = useApp();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useEffect(() => {
    let live = true;
    const refresh = () => void services.engine.status().then((next) => live && setStatus(next));
    refresh();
    const unsubscribe = services.engine.subscribe(refresh);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [services]);
  return status;
}
