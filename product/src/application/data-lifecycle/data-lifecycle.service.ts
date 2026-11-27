import type { AuthContext } from '../../ports/auth';
import { DataLifecycleError, type DataLifecycleStore, type LifecycleDataClass, type LifecyclePolicyInput } from '../../ports/data-lifecycle';

/** ADR-006: lifecycle planning is admin-only. No execution capability is granted. */
export class DataLifecycleService {
  constructor(private readonly store: DataLifecycleStore) {}
  private authorize(ctx: AuthContext): void {
    if (ctx.role !== 'admin' || ctx.isDemo) throw new DataLifecycleError('FORBIDDEN', 403);
  }
  private dataClass(value: unknown): LifecycleDataClass {
    if (value !== 'accepted_evidence' && value !== 'audit') throw new DataLifecycleError('INVALID_INPUT', 400);
    return value;
  }
  async configure(ctx: AuthContext, body: unknown) {
    this.authorize(ctx);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DataLifecycleError('INVALID_INPUT', 400);
    const value = body as Record<string, unknown>;
    if (Object.keys(value).sort().join(',') !== 'approvalRef,dataClass,expectedRevision,retentionSeconds'
      || !Number.isInteger(value.retentionSeconds) || Number(value.retentionSeconds) < 1 || Number(value.retentionSeconds) > 2_147_483_647
      || !Number.isInteger(value.expectedRevision) || Number(value.expectedRevision) < 0 || Number(value.expectedRevision) >= 2_147_483_647
      || typeof value.approvalRef !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value.approvalRef)) {
      throw new DataLifecycleError('INVALID_INPUT', 400);
    }
    const input: LifecyclePolicyInput = { dataClass: this.dataClass(value.dataClass), retentionSeconds: Number(value.retentionSeconds),
      expectedRevision: Number(value.expectedRevision), approvalRef: value.approvalRef };
    return this.store.configure(ctx.workspaceId, ctx.userId, input);
  }
  async preview(ctx: AuthContext, dataClass: unknown) {
    this.authorize(ctx);
    return this.store.preview(ctx.workspaceId, ctx.userId, this.dataClass(dataClass));
  }
}
