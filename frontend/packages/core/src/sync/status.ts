export type Connectivity = 'online' | 'offline' | 'serverDown' | 'sessionExpired';

export interface SyncStatus {
  connectivity: Connectivity;
  /** Changes still to send (the "N waiting" on the chip). */
  waiting: number;
  /** Changes the server refused; the person must fix or discard them. */
  failed: number;
  /** Edits that lost to someone else's; the person picks "Keep mine" or "Keep theirs". */
  conflicts: number;
  lastSyncedAt: number | null;
  /** When to call `sync()` again on a timer, or null. */
  nextRetryAt: number | null;
  /** What the chip shows. Driven by the outbox, not by reachability. */
  chip: 'synced' | 'waiting' | 'failed';
}

export interface SyncResult {
  /** Why nothing was sent, if the run was skipped. */
  skipped?: 'sessionExpired';
  sent: number;
  pulled: boolean;
}
