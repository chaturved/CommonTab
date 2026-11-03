export type Connectivity = 'online' | 'offline' | 'serverDown' | 'sessionExpired';

export interface SyncStatus {
  connectivity: Connectivity;
  waiting: number;
  failed: number;
  conflicts: number;
  lastSyncedAt: number | null;
  nextRetryAt: number | null;
  chip: 'synced' | 'waiting' | 'failed';
}

export interface SyncResult {
  skipped?: 'sessionExpired';
  sent: number;
  pulled: boolean;
}
