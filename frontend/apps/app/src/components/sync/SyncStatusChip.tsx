import type { SyncState } from '@commontab/ui';
import { SyncChip } from '@commontab/ui';
import { useSyncStatus } from '@/hooks/useSyncStatus';

export function useChipState(): SyncState | null {
  const status = useSyncStatus();
  if (!status || status.connectivity !== 'online') return null;
  if (status.chip === 'failed') return { kind: 'failed' };
  if (status.chip === 'waiting') return { kind: 'waiting', count: status.waiting };
  return { kind: 'synced' };
}

export function SyncStatusChip() {
  const state = useChipState();
  return state ? <SyncChip state={state} /> : null;
}
