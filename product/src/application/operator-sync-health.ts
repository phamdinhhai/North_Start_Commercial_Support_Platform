import type { AuthContext } from '../ports/auth';
import type { SyncHealthControl, SyncHealthReader, SyncHealthSource, OperatorSyncState } from '../ports/operator-sync-health';
import { SyncHealthError as HealthError } from '../ports/operator-sync-health';

export const SYNC_HEALTH_LIMIT = 100;
const privileged = new Set(['admin','manager']);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
function state(row: SyncHealthSource): OperatorSyncState {
  if (row.status === 'revoked') return 'REVOKED';
  if (row.status === 'paused') return 'DISABLED';
  if (row.status === 'blocked' || row.gapStatus === 'DETECTED') return 'BLOCKED';
  if (row.status === 'degraded' || row.failureCode) return 'DEGRADED';
  if (row.mode === 'offline-synthetic') return 'SYNTHETIC_ONLY';
  if (!row.lastCommittedAt) return 'AUTHORIZATION_PENDING';
  return row.status === 'active' ? 'SYNCING' : 'DISABLED';
}
function visible(row: SyncHealthSource, observedAt: string) {
  return {
    streamId: row.id, connectionId: row.connectionId, provider: row.provider, mode: row.mode,
    state: state(row), completed: row.completed, cursorVersion: row.cursorVersion,
    lastAttemptedAt: row.lastAttemptedAt, lastCommittedAt: row.lastCommittedAt,
    retryCount: row.retryCount, nextRetryAt: row.nextRetryAt, failureCode: row.failureCode,
    gapStatus: row.gapStatus, lag: 'UNKNOWN' as const, observedAt,
    completeness: 'UNKNOWN' as const,
  };
}
export class OperatorSyncHealthQuery {
  constructor(private readonly reader: SyncHealthReader, private readonly control: SyncHealthControl, private readonly enabled = false) {}
  private auth(ctx: AuthContext|null): AuthContext {
    if (!ctx || !text(ctx.workspaceId) || !text(ctx.userId)) throw new HealthError('UNAUTHORIZED',401);
    if (ctx.isDemo || !privileged.has(ctx.role)) throw new HealthError('FORBIDDEN',403);
    return ctx;
  }
  async report(ctx: AuthContext|null) {
    if (!this.enabled) throw new HealthError('HEALTH_UNAVAILABLE',404);
    const c=this.auth(ctx); let page;
    try { page=await this.reader.list(c.workspaceId,SYNC_HEALTH_LIMIT); } catch { throw new HealthError('HEALTH_UNAVAILABLE',503); }
    if (!page || typeof page.observedAt !== 'string' || !Array.isArray(page.items)) throw new HealthError('HEALTH_UNAVAILABLE',503);
    return { classification:'OPERATIONAL_SYNC_TELEMETRY_NOT_COMMERCIAL_EVIDENCE' as const, workspaceId:c.workspaceId,
      observedAt:page.observedAt, completeness:'UNKNOWN' as const, items:page.items.filter(x=>x.workspaceId===c.workspaceId).slice(0,SYNC_HEALTH_LIMIT).map(x=>visible(x,page.observedAt)), truncated:page.truncated };
  }
  async command(ctx: AuthContext|null, streamId: string, action: 'pause'|'resume'|'revoke') {
    if (!this.enabled) throw new HealthError('HEALTH_UNAVAILABLE',404);
    const c=this.auth(ctx); if(c.role!=='admin') throw new HealthError('FORBIDDEN',403);
    if(!text(streamId) || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(streamId) || !['pause','resume','revoke'].includes(action)) throw new HealthError('INPUT_INVALID',400);
    try { await this.control.control(c.workspaceId,streamId,action,c.userId); } catch { throw new HealthError('CONTROL_UNAVAILABLE',503); }
    return {streamId, action, accepted:true, asynchronous:true};
  }
}
