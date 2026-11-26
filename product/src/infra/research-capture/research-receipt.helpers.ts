import { validContentDigest, type ContentDigest } from '../../ports/content-digester';
import type { ResearchCipherAadContext, ResearchCipherMetadata } from '../../ports/research-capture-crypto';
import {
  MAX_RESEARCH_RETENTION_DAYS,
  ResearchReceiptError,
  type ResearchFailureRecord,
  type ResearchReceipt,
  type ResearchReceiptReadSelector,
  type StoredResearchReceiptMetadata,
} from '../../ports/research-receipt.port';
import { resolveDeploymentMode, type SqlExecutor } from '../postgres/postgres.service';

export interface StoredRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly connection_id: string;
  readonly account_id: string;
  readonly provider_surface: 'pancake-pos';
  readonly receipt_id: string;
  readonly received_at: Date;
  readonly accepted_at: Date;
  readonly retention_days: number;
  readonly expires_at: Date;
  readonly payload_digest: ContentDigest;
  readonly encryption_meta: ResearchCipherMetadata;
  readonly ciphertext: Buffer;
}

export const ID_PATTERN = /^[^\x00-\x1f]{1,256}$/;
export const ACTOR_PATTERN = /^[^\x00-\x1f]{1,256}$/;
export const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T.*Z$/;
const SELF_DESCRIBING_DIGEST = /^hmac-sha256:([A-Za-z0-9._-]{1,64}):([a-f0-9]{64})$/;
const MAX_RAW_BYTES = 262_144;
const AUDIT_ENTITY = 'research-capture-receipt';

export function researchCaptureStorageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.RESEARCH_CAPTURE_STORAGE_ENABLED ?? '';
  if (!['', 'false', 'true'].includes(raw)) throw new ResearchReceiptError('RESEARCH_ONLY', 503);
  if (raw !== 'true') return false;
  if (env.NODE_ENV === 'production' || !['local', 'test'].includes(resolveDeploymentMode(env))) {
    throw new ResearchReceiptError('RESEARCH_ONLY', 503);
  }
  return true;
}

export function selectorKey(sel: ResearchReceiptReadSelector): string {
  return `${sel.connectionId}:${sel.accountId}:${sel.providerSurface}:${sel.receiptId}`;
}

export function validateReceiptEnvelope(receipt: ResearchReceipt): void {
  if (
    receipt.evidenceType !== 'synthetic'
    || receipt.schemaStatus !== 'uninterpreted'
    || typeof receipt.receivedAt !== 'string'
    || !ISO_UTC_PATTERN.test(receipt.receivedAt)
    || !Number.isFinite(Date.parse(receipt.receivedAt))
    || !Number.isSafeInteger(receipt.retentionDays)
    || receipt.retentionDays < 1
    || receipt.retentionDays > MAX_RESEARCH_RETENTION_DAYS
  ) {
    throw new ResearchReceiptError('INVALID_RECEIPT', 400);
  }
}

export function parseReceiptDigest(receipt: ResearchReceipt): ContentDigest {
  if (receipt.payloadDigest !== undefined) {
    if (!validContentDigest(receipt.payloadDigest)) {
      throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    }
    if (receipt.payloadHash !== `hmac-sha256:${receipt.payloadDigest.kid}:${receipt.payloadDigest.value}`) {
      throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    }
    return receipt.payloadDigest;
  }
  const match = SELF_DESCRIBING_DIGEST.exec(receipt.payloadHash ?? '');
  if (!match) throw new ResearchReceiptError('INVALID_RECEIPT', 400);
  return { alg: 'HMAC-SHA256', kid: match[1], value: match[2] };
}

export function extractRawBytes(receipt: ResearchReceipt): Buffer {
  let fromBinary: Buffer | undefined;
  let fromBase64: Buffer | undefined;
  if (receipt.rawBody !== undefined) {
    if (!(receipt.rawBody instanceof Uint8Array)) throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    fromBinary = Buffer.from(receipt.rawBody);
  }
  if (receipt.rawBodyBase64 !== undefined) {
    if (typeof receipt.rawBodyBase64 !== 'string' || !receipt.rawBodyBase64.length) {
      throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    }
    const decoded = Buffer.from(receipt.rawBodyBase64, 'base64');
    if (decoded.toString('base64') !== receipt.rawBodyBase64) {
      throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    }
    fromBase64 = decoded;
  }
  if (!fromBinary && !fromBase64) throw new ResearchReceiptError('INVALID_RECEIPT', 400);
  if (fromBinary && fromBase64 && !fromBinary.equals(fromBase64)) {
    throw new ResearchReceiptError('INVALID_RECEIPT', 400);
  }
  const raw = fromBinary ?? fromBase64!;
  if (raw.byteLength === 0 || raw.byteLength > MAX_RAW_BYTES) {
    throw new ResearchReceiptError('INVALID_RECEIPT', 400);
  }
  return raw;
}

export function toAadContext(row: {
  workspaceId: string;
  connectionId: string;
  accountId: string;
  providerSurface: 'pancake-pos';
  receiptId: string;
  acceptedAt: string;
  expiresAt: string;
  retentionDays: number;
  payloadDigest: ContentDigest;
}): ResearchCipherAadContext {
  return {
    workspaceId: row.workspaceId,
    connectionId: row.connectionId,
    accountId: row.accountId,
    providerSurface: row.providerSurface,
    receiptId: row.receiptId,
    acceptedAt: row.acceptedAt,
    expiresAt: row.expiresAt,
    retentionDays: row.retentionDays,
    payloadDigestKid: row.payloadDigest.kid,
    payloadDigestValue: row.payloadDigest.value,
  };
}

export function toMetadata(row: StoredRow): StoredResearchReceiptMetadata {
  return Object.freeze({
    workspaceId: row.workspace_id,
    connectionId: row.connection_id,
    accountId: row.account_id,
    providerSurface: row.provider_surface,
    receiptId: row.receipt_id,
    receivedAt: row.received_at.toISOString(),
    acceptedAt: row.accepted_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    retentionDays: row.retention_days,
    payloadDigest: Object.freeze({ ...row.payload_digest }),
    encryption: Object.freeze({ ...row.encryption_meta }),
    evidenceType: 'synthetic' as const,
    schemaStatus: 'uninterpreted' as const,
  });
}

export async function writeResearchCaptureAudit(
  tx: SqlExecutor,
  params: {
    workspaceId: string;
    receiptRowId: string;
    connectionId: string;
    accountId: string;
    providerSurface: 'pancake-pos';
    receiptId: string;
    operation: 'STORED' | 'DUPLICATE_OBSERVED' | 'READ' | 'EXPIRED_READ_DENIED' | 'PURGED' | 'UNKNOWN_KEY_OBSERVED';
    actor: string;
    digestKid: string;
    encryptionKid: string;
    acceptedAt: string;
    expiresAt: string;
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO research_capture_audit (
       workspace_id, receipt_row_id, connection_id, account_id, provider_surface,
       receipt_id, operation, actor, digest_kid, encryption_kid, accepted_at, expires_at
     ) VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz)`,
    [
      params.workspaceId, params.receiptRowId, params.connectionId, params.accountId,
      params.providerSurface, params.receiptId, params.operation, params.actor,
      params.digestKid, params.encryptionKid, params.acceptedAt, params.expiresAt,
    ],
  );
  const summary = {
    operation: params.operation,
    connectionId: params.connectionId,
    accountId: params.accountId,
    providerSurface: params.providerSurface,
    receiptId: params.receiptId,
    digestKid: params.digestKid,
    encryptionKid: params.encryptionKid,
    acceptedAt: params.acceptedAt,
    expiresAt: params.expiresAt,
  };
  await tx.query(
    `INSERT INTO audit_record (entity_type, entity_id, workspace_id, actor, event_type, new_value)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      AUDIT_ENTITY, params.receiptRowId, params.workspaceId, params.actor,
      `research.capture.${params.operation.toLowerCase()}`, JSON.stringify(summary),
    ],
  );
}

export async function recordResearchFailure(
  db: SqlExecutor,
  workspaceId: string,
  failureKey: string,
  receiptKey: string | null,
  stage: 'purge' | 'read',
  errorCode: ResearchFailureRecord['errorCode'],
): Promise<void> {
  await db.query(
    `INSERT INTO research_capture_failure (
       workspace_id, failure_key, receipt_key, stage, error_code, attempts, first_failed_at, last_failed_at, resolved_at
     ) VALUES ($1, $2, $3, $4, $5, 1, clock_timestamp(), clock_timestamp(), NULL)
     ON CONFLICT (workspace_id, failure_key) DO UPDATE SET
       error_code = EXCLUDED.error_code,
       attempts = CASE WHEN research_capture_failure.resolved_at IS NULL THEN research_capture_failure.attempts + 1 ELSE 1 END,
       first_failed_at = CASE WHEN research_capture_failure.resolved_at IS NULL THEN research_capture_failure.first_failed_at ELSE clock_timestamp() END,
       last_failed_at = clock_timestamp(),
       resolved_at = NULL`,
    [workspaceId, failureKey, receiptKey, stage, errorCode],
  );
}

export async function resolveResearchFailure(
  tx: SqlExecutor,
  workspaceId: string,
  failureKey: string,
): Promise<void> {
  await tx.query(
    `UPDATE research_capture_failure
        SET resolved_at = clock_timestamp()
      WHERE workspace_id = $1 AND failure_key = $2 AND resolved_at IS NULL`,
    [workspaceId, failureKey],
  );
}
