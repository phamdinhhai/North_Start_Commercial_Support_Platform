import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service';
import { IntegrationError, type Enrollment, type Upload, type ReceiptAck, type IntegrationStore } from '../../ports/integration';
export class PgIntegrationStore implements IntegrationStore {
    constructor(private readonly db: PostgresService) { }
    async enroll(e: Enrollment): Promise<void> {
        await this.db.withTransaction(async (tx) => {
            await tx.query('INSERT INTO integration_enrollment(id,scope,expires_at) VALUES($1,$2::jsonb,$3)', [e.id, JSON.stringify(e.scope), e.expiresAt]);
            await tx.query("INSERT INTO integration_audit(enrollment_id,operation) VALUES($1,'enroll')", [e.id]);
        });
    }
    async revoke(id: string): Promise<void> {
        await this.db.withTransaction(async (tx) => {
            const row = await tx.query('SELECT id FROM integration_enrollment WHERE id=$1 FOR UPDATE', [id]);
            if (!row.rows.length)
                throw new IntegrationError('ENROLLMENT_NOT_FOUND', 404);
            await tx.query('UPDATE integration_enrollment SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE id=$1', [id]);
            await tx.query("INSERT INTO integration_audit(enrollment_id,operation) VALUES($1,'revoke')", [id]);
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
            const receiptId = randomUUID();
            await tx.query('INSERT INTO integration_receipt(id,enrollment_id,capture_id,sequence,fingerprint,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)', [receiptId, e.id, u.captureId, u.sequence, fingerprint, JSON.stringify(u)]);
            await tx.query('UPDATE integration_enrollment SET checkpoint=$2 WHERE id=$1', [e.id, u.sequence]);
            await tx.query("INSERT INTO integration_audit(enrollment_id,operation) VALUES($1,'receipt')", [e.id]);
            return { captureId: u.captureId, sequence: u.sequence, enrollmentId: e.id, receiptId, disposition: 'stored', checkpoint: u.sequence, continuity: 'UNKNOWN' };
        });
    }
}
