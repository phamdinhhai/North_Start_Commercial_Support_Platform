import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service';
import { IntegrationError, type Enrollment, type Upload, type ReceiptAck, type IntegrationStore, type IssuanceAudit, type RevocationRequest } from '../../ports/integration';

/**
 * Actor-attributed audit uses the existing append-only `audit_record` table (migration 001)
 * under a dedicated entity type, so no new migration is required. Enrollment UUIDs never
 * match lead/handoff/outcome/work ids, so lead history projections do not include them.
 * Only actor id, role, workspace, scope, kid and expiry are recorded — never token material.
 */
const ENTITY = 'integration-enrollment';
const AUDIT_SQL = `INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,new_value,event_type,reason)
 VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)`;

export class PgIntegrationStore implements IntegrationStore {
    constructor(private readonly db: PostgresService) { }
    async readHybrid(e:Enrollment,acrossConnection=false):Promise<readonly Upload[]> {
        return this.db.withTransaction(async tx=>{
            const active=await tx.query(`SELECT e.id FROM integration_enrollment e WHERE e.id=$1 AND e.scope=$2::jsonb
              AND e.expires_at=$3::timestamptz AND e.revoked_at IS NULL AND e.expires_at>clock_timestamp() FOR SHARE`,[e.id,JSON.stringify(e.scope),e.expiresAt]);
            if(!active.rows.length)throw new IntegrationError('ENROLLMENT_INACTIVE',401);
            const principal=await tx.query(`SELECT m.id FROM memberships m JOIN platform_user u ON u.id=m.user_id
              WHERE m.workspace_id=$1 AND m.status='active' AND m.revoked_at IS NULL AND m.base_role='admin' AND u.status='active'
              AND m.user_id::text=(SELECT actor FROM audit_record WHERE entity_type='integration-enrollment' AND entity_id=$2
                AND event_type='integration.enrollment.issued' ORDER BY timestamp LIMIT 1) FOR SHARE OF m,u`,[e.scope.workspaceId,e.id]);
            if(!principal.rows.length)throw new IntegrationError('ENROLLMENT_PRINCIPAL_INACTIVE',401);
            const rows=await tx.query<{metadata:Upload}>(acrossConnection?'SELECT r.metadata FROM integration_receipt r JOIN integration_enrollment e ON e.id=r.enrollment_id WHERE e.scope=$1::jsonb ORDER BY r.received_at,r.id LIMIT 101':'SELECT metadata FROM integration_receipt WHERE enrollment_id=$1 ORDER BY sequence LIMIT 101',[acrossConnection?JSON.stringify(e.scope):e.id]);
            if(rows.rows.length>100)throw new IntegrationError('RECONCILIATION_CAPACITY_REACHED',409);
            return rows.rows.map(r=>r.metadata);
        });
    }
    async enroll(e: Enrollment, audit: IssuanceAudit): Promise<void> {
        await this.db.withTransaction(async (tx) => {
            await tx.query('INSERT INTO integration_enrollment(id,scope,expires_at) VALUES($1,$2::jsonb,$3)', [e.id, JSON.stringify(e.scope), e.expiresAt]);
            await tx.query("INSERT INTO integration_audit(enrollment_id,operation) VALUES($1,'enroll')", [e.id]);
            const detail = { issuance: audit.issuance, role: audit.role, scope: e.scope, kid: audit.kid, capability: 'observation:append', expiresAt: e.expiresAt };
            await tx.query(AUDIT_SQL, [ENTITY, e.id, e.scope.workspaceId, audit.actorId, JSON.stringify(detail), 'integration.enrollment.issued', audit.issuance === 'issuer-secret' ? 'deprecated issuer-secret path' : null]);
        });
    }
    async revoke(id: string, request: RevocationRequest): Promise<void> {
        await this.db.withTransaction(async (tx) => {
            const row = await tx.query<{ workspace_id: string }>("SELECT scope->>'workspaceId' AS workspace_id FROM integration_enrollment WHERE id=$1 FOR UPDATE", [id]);
            // A principal of another workspace receives the same answer as a missing id.
            if (!row.rows.length || (request.workspaceId !== null && row.rows[0].workspace_id !== request.workspaceId))
                throw new IntegrationError('ENROLLMENT_NOT_FOUND', 404);
            await tx.query('UPDATE integration_enrollment SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE id=$1', [id]);
            await tx.query("INSERT INTO integration_audit(enrollment_id,operation) VALUES($1,'revoke')", [id]);
            const detail = { issuance: request.issuance, role: request.role };
            await tx.query(AUDIT_SQL, [ENTITY, id, row.rows[0].workspace_id, request.actorId, JSON.stringify(detail), 'integration.enrollment.revoked', null]);
        });
    }
    async append(e: Enrollment, u: Upload, fingerprint: string): Promise<ReceiptAck> {
        return this.db.withTransaction(async (tx) => {
            // Row lock serializes checkpoint, receipt and revocation; clock_timestamp observes lock wait.
            const r = await tx.query<{
                scope: Enrollment['scope'];
                checkpoint: string;
            }>('SELECT scope,checkpoint FROM integration_enrollment WHERE id=$1 FOR UPDATE', [e.id]);
            const row = r.rows[0];
            const valid = await tx.query('SELECT id FROM integration_enrollment WHERE id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() AND scope=$2::jsonb AND expires_at=$3::timestamptz', [e.id, JSON.stringify(e.scope), e.expiresAt]);
            if (!row || !valid.rows.length)
                throw new IntegrationError('ENROLLMENT_INACTIVE', 401);
            if(e.scope.target) {
                const active=await tx.query(`SELECT m.id FROM memberships m JOIN platform_user u ON u.id=m.user_id
                  WHERE m.workspace_id=$1 AND m.status='active' AND m.revoked_at IS NULL AND m.base_role='admin' AND u.status='active'
                  AND m.user_id::text=(SELECT actor FROM audit_record WHERE entity_type='integration-enrollment' AND entity_id=$2
                    AND event_type='integration.enrollment.issued' ORDER BY timestamp LIMIT 1) FOR SHARE OF m,u`,[e.scope.workspaceId,e.id]);
                if(!active.rows.length)throw new IntegrationError('ENROLLMENT_PRINCIPAL_INACTIVE',401);
            }
            const existing = await tx.query<{
                id: string;
                fingerprint: string;
            }>('SELECT id,fingerprint FROM integration_receipt WHERE enrollment_id=$1 AND capture_id=$2', [e.id, u.captureId]);
            if (existing.rows[0]) {
                if (existing.rows[0].fingerprint !== fingerprint)
                    throw new IntegrationError('RECEIPT_CONFLICT', 409);
                return { captureId: u.captureId, sequence: u.sequence, enrollmentId: e.id, receiptId: existing.rows[0].id, disposition: 'duplicate', checkpoint: Number(row.checkpoint), continuity: 'UNKNOWN' };
            }
            if (u.sequence <= Number(row.checkpoint))
                throw new IntegrationError('CHECKPOINT_REGRESSION', 409);
            // Do not acknowledge past a missing local delivery. The sender retains
            // this request and can deliver the earlier sequence before retrying.
            if (u.sequence !== Number(row.checkpoint) + 1)
                throw new IntegrationError('SEQUENCE_GAP', 409);
            const receiptId = randomUUID();
            await tx.query('INSERT INTO integration_receipt(id,enrollment_id,capture_id,sequence,fingerprint,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)', [receiptId, e.id, u.captureId, u.sequence, fingerprint, JSON.stringify(u)]);
            await tx.query('UPDATE integration_enrollment SET checkpoint=$2 WHERE id=$1', [e.id, u.sequence]);
            await tx.query("INSERT INTO integration_audit(enrollment_id,operation) VALUES($1,'receipt')", [e.id]);
            return { captureId: u.captureId, sequence: u.sequence, enrollmentId: e.id, receiptId, disposition: 'stored', checkpoint: u.sequence, continuity: 'UNKNOWN' };
        });
    }
}
