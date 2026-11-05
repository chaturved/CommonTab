import type { SyncStatus } from '@commontab/core';

export function syncLabel(status: SyncStatus | null, now: number): string {
  if (!status) return 'Syncing…';
  if (status.connectivity === 'offline') return 'Offline';
  if (status.connectivity === 'serverDown') return "Can't reach CommonTab";
  if (status.connectivity === 'sessionExpired') return 'Sign in again to sync';
  if (status.chip === 'failed') return "Couldn't sync some changes";
  if (status.chip === 'waiting') return `${status.waiting} waiting to sync`;
  if (status.lastSyncedAt === null) return 'Synced';
  const seconds = (now - status.lastSyncedAt) / 1000;
  if (seconds < 60) return 'Synced just now';
  const time = new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Synced ${time}`;
}
