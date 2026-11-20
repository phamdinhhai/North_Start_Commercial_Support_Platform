import type { AuthContext } from './auth';

export type OperatorSyncState = 'SYNTHETIC_ONLY'|'DISABLED'|'SYNCING'|'DEGRADED'|'REVOKED'|'BLOCKED'|'AUTHORIZATION_PENDING';
export type OperatorSyncFailure = 'AUTH_REVOKED'|'RATE_LIMITED'|'TIMEOUT'|'SCHEMA_INVALID'|'GAP_DETECTED'|'DATABASE_UNAVAILABLE'|'RETRY_EXHAUSTED'|null;

/** Server-derived facts only. Cursor contents and lease tokens never cross this port. */
export interface SyncHealthSource {
  readonly id: string; readonly workspaceId: string; readonly connectionId: string;
  readonly provider: 'pancake'|'meta-page'; readonly mode: 'offline-synthetic'|'provider-read-only';
  readonly status: 'active'|'paused'|'revoked'|'degraded'|'blocked';
  readonly cursorVersion: number; readonly completed: boolean;
  readonly lastAttemptedAt: string|null; readonly lastCommittedAt: string|null;
  readonly retryCount: number; readonly nextRetryAt: string|null;
  readonly failureCode: OperatorSyncFailure; readonly gapStatus: 'UNKNOWN'|'NONE'|'DETECTED';
}
export interface SyncHealthReader { list(workspaceId: string, limit: number): Promise<{items: readonly SyncHealthSource[]; observedAt: string; truncated: boolean}>; }
export interface SyncHealthControl { control(workspaceId: string, streamId: string, action: 'pause'|'resume'|'revoke', actorId: string): Promise<void>; }
export class SyncHealthError extends Error { constructor(readonly code: 'UNAUTHORIZED'|'FORBIDDEN'|'INPUT_INVALID'|'HEALTH_UNAVAILABLE'|'CONTROL_UNAVAILABLE', readonly status: number) { super(code); } }
export const SYNC_HEALTH_READER = Symbol('SYNC_HEALTH_READER');
export const SYNC_HEALTH_CONTROL = Symbol('SYNC_HEALTH_CONTROL');
export type SyncHealthContext = AuthContext;
