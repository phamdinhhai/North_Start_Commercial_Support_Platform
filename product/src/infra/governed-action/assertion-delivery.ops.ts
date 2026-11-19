import { Injectable, Inject } from '@nestjs/common';
import type { AuthContext } from '../../ports/auth';
import { PostgresService } from '../postgres/postgres.service';
import { deliveryEnabled } from './assertion-delivery.runner';
import { PgAssertionDelivery, PgAssertionInbox } from './pg-assertion-delivery';
export class AssertionOpsError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
/** ADR-006 admin only; ADR-007 research-only; responses contain no evidence. */
@Injectable()
export class AssertionDeliveryOps {
  constructor(@Inject(PostgresService) private readonly db: PostgresService) {}
  authorize(ctx: AuthContext | null): AuthContext {
    if (!deliveryEnabled()) throw new AssertionOpsError('ASSERTION_DELIVERY_DISABLED',404);
    if (process.env.AUTH_MODE !== 'oidc') throw new AssertionOpsError('FORBIDDEN',403);
    if (!ctx) throw new AssertionOpsError('UNAUTHORIZED',401);
    if (ctx.role !== 'admin' || ctx.isDemo || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ctx.userId)) throw new AssertionOpsError('FORBIDDEN',403);
    return ctx;
  }
  async inspect(ctx: AuthContext | null) {
    const actor=this.authorize(ctx);
    return new PgAssertionDelivery(this.db,new PgAssertionInbox(this.db)).inspect(actor.workspaceId);
  }
  async change(ctx: AuthContext | null, assertionId: string, operation: 'replay' | 'stop') {
    const actor=this.authorize(ctx);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assertionId) || !['replay','stop'].includes(operation)) throw new AssertionOpsError('INPUT_INVALID',400);
    return this.db.withTransaction(async tx=>{
      const rows=await tx.query<{status:string;attempts:number;last_error:string|null}>(
        'SELECT status,attempts,last_error FROM assertion_outbox WHERE workspace_id=$1 AND assertion_id=$2 FOR UPDATE',[actor.workspaceId,assertionId]);
      const row=rows.rows[0];
      // Poison is immutable. Stop refuses live leases; disable scheduler and wait for expiry first.
      if (!row || (operation==='replay' ? row.status!=='FAILED' || ['INVALID_ENVELOPE','ENVELOPE_CONFLICT'].includes(row.last_error??'') : row.status!=='PENDING')) throw new AssertionOpsError('DELIVERY_CONFLICT',409);
      await tx.query(`UPDATE assertion_outbox SET status=$3,attempts=CASE WHEN $3='PENDING' THEN 0 ELSE attempts END,
        next_attempt_at=now(),last_error=$4,lease_token=NULL,lease_until=NULL WHERE workspace_id=$1 AND assertion_id=$2`,
      [actor.workspaceId,assertionId,operation==='replay'?'PENDING':'FAILED',operation==='replay'?null:'OPERATOR_STOP']);
      await tx.query(`INSERT INTO assertion_delivery_audit(workspace_id,assertion_id,actor,operation,previous_status,previous_attempts)
        VALUES($1,$2,$3,$4,$5,$6)`,[actor.workspaceId,assertionId,actor.userId,operation,row.status,row.attempts]);
      return {assertionId,operation};
    });
  }
}
