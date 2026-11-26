import { randomUUID } from 'node:crypto';
import type { ContentDigester } from '../../ports/content-digester';
import { validResearchCipherMetadata, type ResearchCaptureCipher } from '../../ports/research-capture-crypto';
import {
  ResearchReceiptError,
  type EncryptedResearchReceiptStore,
  type ResearchFailureRecord,
  type ResearchPurgeSummary,
  type ResearchReceipt,
  type ResearchReceiptAppendDisposition,
  type ResearchReceiptReadResult,
  type ResearchReceiptReadSelector,
} from '../../ports/research-receipt.port';
import type { TransactionRunner } from '../postgres/migrator';
import type { SqlExecutor } from '../postgres/postgres.service';
import {
  ACTOR_PATTERN,
  extractRawBytes,
  ID_PATTERN,
  parseReceiptDigest,
  recordResearchFailure,
  researchCaptureStorageEnabled,
  resolveResearchFailure,
  selectorKey,
  toAadContext,
  toMetadata,
  validateReceiptEnvelope,
  writeResearchCaptureAudit,
  type StoredRow,
} from './research-receipt.helpers';

export { researchCaptureStorageEnabled } from './research-receipt.helpers';

export interface PgResearchReceiptStoreOptions {
  readonly enabled: boolean;
  readonly deploymentMode: string;
  readonly authorizedWorkspaceIds: readonly string[];
  readonly cipher: ResearchCaptureCipher;
  readonly digester: ContentDigester;
  readonly defaultActor?: string;
}

/**
 * ADR-009 §3 / R3 A-04: Bounded server-side encrypted-at-rest research receipt store.
 * - Defaults disabled; synthetic/local-or-test gated; explicit authorized workspace list.
 * - Separate AES-256-GCM encryption (`ResearchCaptureCipher`) and HMAC-SHA256 digest (`ContentDigester`).
 * - Never persists raw JSON or base64 as encryption; stores `BYTEA` ciphertext + authenticated AAD metadata.
 * - Trusted PostgreSQL `transaction_timestamp()` sets `accepted_at` and immutable `expires_at <= accepted_at + 7 days`.
 * - Duplicate delivery checks digest against incoming bytes (`UNKNOWN` if old digest key missing) and NEVER extends `expires_at`.
 * - Expired reads are denied before decryption; automatic/batched `purgeExpired` uses `FOR UPDATE SKIP LOCKED`
 *   with atomic same-transaction `PURGED` audit and explicit failure ledger/recovery semantics.
 */
export class PgResearchReceiptStore implements EncryptedResearchReceiptStore {
  private readonly authorizedWorkspaces: ReadonlySet<string>;
  private readonly defaultActor: string;

  constructor(
    private readonly db: TransactionRunner & SqlExecutor,
    private readonly options: PgResearchReceiptStoreOptions,
  ) {
    if (!options || options.enabled !== true) {
      throw new ResearchReceiptError('RESEARCH_CAPTURE_DISABLED', 404);
    }
    this.guardEnvironment();
    if (!options.cipher || typeof options.cipher.encrypt !== 'function' || typeof options.cipher.decrypt !== 'function') {
      throw new ResearchReceiptError('PLAINTEXT_STORAGE_FORBIDDEN', 503);
    }
    if (!options.digester || typeof options.digester.digest !== 'function' || typeof options.digester.matches !== 'function') {
      throw new ResearchReceiptError('PLAINTEXT_STORAGE_FORBIDDEN', 503);
    }
    if (!Array.isArray(options.authorizedWorkspaceIds) || options.authorizedWorkspaceIds.length === 0
      || options.authorizedWorkspaceIds.some((ws) => typeof ws !== 'string' || !ID_PATTERN.test(ws))) {
      throw new ResearchReceiptError('FORBIDDEN', 403);
    }
    this.authorizedWorkspaces = new Set(options.authorizedWorkspaceIds);
    this.defaultActor = options.defaultActor ?? 'system:research-capture';
    if (!ACTOR_PATTERN.test(this.defaultActor)) throw new ResearchReceiptError('INVALID_RECEIPT', 400);
  }

  private guardEnvironment(): void {
    const mode = (this.options.deploymentMode ?? '').trim().toLowerCase();
    if (!['local', 'test'].includes(mode) || process.env.NODE_ENV === 'production') {
      throw new ResearchReceiptError('RESEARCH_ONLY', 503);
    }
  }

  private requireWorkspaceAuthorized(workspaceId: string): void {
    this.guardEnvironment();
    if (!ID_PATTERN.test(workspaceId ?? '') || !this.authorizedWorkspaces.has(workspaceId)) {
      throw new ResearchReceiptError('FORBIDDEN', 403);
    }
  }

  private validateSelector(selector: ResearchReceiptReadSelector): void {
    if (!selector
      || !ID_PATTERN.test(selector.workspaceId ?? '')
      || !ID_PATTERN.test(selector.connectionId ?? '')
      || !ID_PATTERN.test(selector.accountId ?? '')
      || selector.providerSurface !== 'pancake-pos'
      || !ID_PATTERN.test(selector.receiptId ?? '')) {
      throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    }
    this.requireWorkspaceAuthorized(selector.workspaceId);
  }

  async append(receipt: ResearchReceipt): Promise<ResearchReceiptAppendDisposition> {
    if (!receipt || typeof receipt !== 'object') throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    this.validateSelector(receipt);
    validateReceiptEnvelope(receipt);

    const incomingDigest = parseReceiptDigest(receipt);
    const rawBytes = extractRawBytes(receipt);
    try {
      const verifyIncoming = this.options.digester.matches(receipt.workspaceId, 'receipt', rawBytes, incomingDigest);
      if (verifyIncoming !== true) {
        if (verifyIncoming === 'UNKNOWN') return 'UNKNOWN';
        throw new ResearchReceiptError('INVALID_RECEIPT', 400);
      }

      return await this.db.withTransaction(async (tx) => {
        const lockKey = `research-receipt:${receipt.workspaceId}:${selectorKey(receipt)}`;
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);

        const existingRes = await tx.query<StoredRow>(
          `SELECT id, workspace_id, connection_id, account_id, provider_surface, receipt_id,
                  received_at, accepted_at, retention_days, expires_at, payload_digest, encryption_meta, ciphertext
             FROM research_capture_receipt
            WHERE workspace_id = $1 AND connection_id = $2 AND account_id = $3
              AND provider_surface = $4 AND receipt_id = $5
            FOR SHARE`,
          [receipt.workspaceId, receipt.connectionId, receipt.accountId, receipt.providerSurface, receipt.receiptId],
        );

        if (existingRes.rows[0]) {
          const existing = existingRes.rows[0];
          const matchExisting = this.options.digester.matches(
            receipt.workspaceId, 'receipt', rawBytes, existing.payload_digest,
          );
          if (matchExisting === false) return 'conflict';
          const op = matchExisting === 'UNKNOWN' ? 'UNKNOWN_KEY_OBSERVED' : 'DUPLICATE_OBSERVED';
          await writeResearchCaptureAudit(tx, {
            workspaceId: existing.workspace_id,
            receiptRowId: existing.id,
            connectionId: existing.connection_id,
            accountId: existing.account_id,
            providerSurface: existing.provider_surface,
            receiptId: existing.receipt_id,
            operation: op,
            actor: this.defaultActor,
            digestKid: existing.payload_digest.kid,
            encryptionKid: existing.encryption_meta.kid,
            acceptedAt: existing.accepted_at.toISOString(),
            expiresAt: existing.expires_at.toISOString(),
          });
          return matchExisting === 'UNKNOWN' ? 'UNKNOWN' : 'duplicate';
        }

        const clock = await tx.query<{ accepted_at: Date; expires_at: Date }>(
          `SELECT transaction_timestamp() AS accepted_at,
                  transaction_timestamp() + ($1::integer * interval '1 day') AS expires_at`,
          [receipt.retentionDays],
        );
        const acceptedAt = clock.rows[0].accepted_at.toISOString();
        const expiresAt = clock.rows[0].expires_at.toISOString();
        const aad = toAadContext({
          workspaceId: receipt.workspaceId,
          connectionId: receipt.connectionId,
          accountId: receipt.accountId,
          providerSurface: receipt.providerSurface,
          receiptId: receipt.receiptId,
          acceptedAt,
          expiresAt,
          retentionDays: receipt.retentionDays,
          payloadDigest: incomingDigest,
        });

        const encrypted = this.options.cipher.encrypt(aad, rawBytes);
        if (!validResearchCipherMetadata(encrypted.metadata) || !(encrypted.ciphertext instanceof Uint8Array)) {
          throw new ResearchReceiptError('PLAINTEXT_STORAGE_FORBIDDEN', 503);
        }
        const ciphertextBuf = Buffer.from(encrypted.ciphertext);
        if (ciphertextBuf.equals(rawBytes) || ciphertextBuf.equals(Buffer.from(rawBytes.toString('base64'), 'utf8'))) {
          throw new ResearchReceiptError('PLAINTEXT_STORAGE_FORBIDDEN', 503);
        }

        const rowId = randomUUID();
        await tx.query(
          `INSERT INTO research_capture_receipt (
             id, workspace_id, connection_id, account_id, provider_surface, receipt_id,
             received_at, accepted_at, retention_days, expires_at,
             payload_digest, encryption_meta, ciphertext, evidence_type, schema_status
           ) VALUES (
             $1::uuid, $2, $3, $4, $5, $6,
             $7::timestamptz, $8::timestamptz, $9, $10::timestamptz,
             $11::jsonb, $12::jsonb, $13, 'synthetic', 'uninterpreted'
           )`,
          [
            rowId, receipt.workspaceId, receipt.connectionId, receipt.accountId,
            receipt.providerSurface, receipt.receiptId, receipt.receivedAt,
            acceptedAt, receipt.retentionDays, expiresAt,
            JSON.stringify(incomingDigest), JSON.stringify(encrypted.metadata), ciphertextBuf,
          ],
        );
        await writeResearchCaptureAudit(tx, {
          workspaceId: receipt.workspaceId,
          receiptRowId: rowId,
          connectionId: receipt.connectionId,
          accountId: receipt.accountId,
          providerSurface: receipt.providerSurface,
          receiptId: receipt.receiptId,
          operation: 'STORED',
          actor: this.defaultActor,
          digestKid: incomingDigest.kid,
          encryptionKid: encrypted.metadata.kid,
          acceptedAt,
          expiresAt,
        });
        return 'stored';
      });
    } finally {
      rawBytes.fill(0);
    }
  }

  async read(selector: ResearchReceiptReadSelector, actorId: string): Promise<ResearchReceiptReadResult> {
    this.validateSelector(selector);
    if (typeof actorId !== 'string' || !ACTOR_PATTERN.test(actorId)) {
      throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    }

    return this.db.withTransaction<ResearchReceiptReadResult>(async (tx) => {
      const res = await tx.query<StoredRow & { is_expired: boolean }>(
        `SELECT id, workspace_id, connection_id, account_id, provider_surface, receipt_id,
                received_at, accepted_at, retention_days, expires_at, payload_digest, encryption_meta, ciphertext,
                (expires_at <= transaction_timestamp()) AS is_expired
           FROM research_capture_receipt
          WHERE workspace_id = $1 AND connection_id = $2 AND account_id = $3
            AND provider_surface = $4 AND receipt_id = $5
          FOR SHARE`,
        [selector.workspaceId, selector.connectionId, selector.accountId, selector.providerSurface, selector.receiptId],
      );
      const row = res.rows[0];
      if (!row) return { status: 'not_found' };

      const acceptedAt = row.accepted_at.toISOString();
      const expiresAt = row.expires_at.toISOString();
      const auditBase = {
        workspaceId: row.workspace_id,
        receiptRowId: row.id,
        connectionId: row.connection_id,
        accountId: row.account_id,
        providerSurface: row.provider_surface,
        receiptId: row.receipt_id,
        actor: actorId,
        digestKid: row.payload_digest.kid,
        encryptionKid: row.encryption_meta.kid,
        acceptedAt,
        expiresAt,
      };

      if (row.is_expired) {
        await writeResearchCaptureAudit(tx, { ...auditBase, operation: 'EXPIRED_READ_DENIED' });
        return { status: 'expired_denied', receiptId: row.receipt_id, expiresAt };
      }

      const metadata = toMetadata(row);
      const aad = toAadContext({
        workspaceId: row.workspace_id,
        connectionId: row.connection_id,
        accountId: row.account_id,
        providerSurface: row.provider_surface,
        receiptId: row.receipt_id,
        acceptedAt,
        expiresAt,
        retentionDays: row.retention_days,
        payloadDigest: row.payload_digest,
      });

      let decrypted;
      try {
        decrypted = this.options.cipher.decrypt(aad, { metadata: row.encryption_meta, ciphertext: row.ciphertext });
      } catch {
        throw new ResearchReceiptError('CIPHERTEXT_INTEGRITY_FAILED', 500);
      }

      if (decrypted.status === 'UNKNOWN') {
        await writeResearchCaptureAudit(tx, { ...auditBase, operation: 'UNKNOWN_KEY_OBSERVED' });
        return { status: 'UNKNOWN', reason: 'ENCRYPTION_KEY_UNAVAILABLE', metadata };
      }

      try {
        const digestCheck = this.options.digester.matches(
          row.workspace_id, 'receipt', decrypted.plaintext, row.payload_digest,
        );
        if (digestCheck === 'UNKNOWN') {
          await writeResearchCaptureAudit(tx, { ...auditBase, operation: 'UNKNOWN_KEY_OBSERVED' });
          return { status: 'UNKNOWN', reason: 'DIGEST_KEY_UNAVAILABLE', metadata };
        }
        if (digestCheck === false) {
          throw new ResearchReceiptError('CIPHERTEXT_INTEGRITY_FAILED', 500);
        }
        await writeResearchCaptureAudit(tx, { ...auditBase, operation: 'READ' });
        return { status: 'ok', metadata, rawBody: Uint8Array.from(decrypted.plaintext) };
      } finally {
        decrypted.plaintext.fill(0);
      }
    }).catch(async (err) => {
      if (err instanceof ResearchReceiptError && err.code === 'CIPHERTEXT_INTEGRITY_FAILED') {
        const key = selectorKey(selector);
        await recordResearchFailure(this.db, selector.workspaceId, `read:${key}`, key, 'read', 'CIPHERTEXT_AUTH_FAILED').catch(() => undefined);
      }
      throw err;
    });
  }

  async purgeExpired(actorId: string = this.defaultActor, batchLimit = 50): Promise<ResearchPurgeSummary> {
    this.guardEnvironment();
    if (!ACTOR_PATTERN.test(actorId) || !Number.isSafeInteger(batchLimit) || batchLimit < 1 || batchLimit > 500) {
      throw new ResearchReceiptError('INVALID_RECEIPT', 400);
    }

    const workspaces = [...this.authorizedWorkspaces];
    let purgedCount = 0;

    try {
      purgedCount = await this.db.withTransaction(async (tx) => {
        const claimed = await tx.query<StoredRow>(
          `SELECT id, workspace_id, connection_id, account_id, provider_surface, receipt_id,
                  received_at, accepted_at, retention_days, expires_at, payload_digest, encryption_meta, ciphertext
             FROM research_capture_receipt
            WHERE workspace_id = ANY($1::text[])
              AND expires_at <= transaction_timestamp()
            ORDER BY expires_at ASC, id ASC
            LIMIT $2
            FOR UPDATE SKIP LOCKED`,
          [workspaces, batchLimit],
        );

        for (const row of claimed.rows) {
          await writeResearchCaptureAudit(tx, {
            workspaceId: row.workspace_id,
            receiptRowId: row.id,
            connectionId: row.connection_id,
            accountId: row.account_id,
            providerSurface: row.provider_surface,
            receiptId: row.receipt_id,
            operation: 'PURGED',
            actor: actorId,
            digestKid: row.payload_digest.kid,
            encryptionKid: row.encryption_meta.kid,
            acceptedAt: row.accepted_at.toISOString(),
            expiresAt: row.expires_at.toISOString(),
          });
          const del = await tx.query(
            `DELETE FROM research_capture_receipt
              WHERE id = $1::uuid AND workspace_id = $2 AND expires_at <= transaction_timestamp()`,
            [row.id, row.workspace_id],
          );
          if (del.rowCount !== 1) throw new ResearchReceiptError('STORAGE_FAILURE', 503);
          const rKey = `${row.connection_id}:${row.account_id}:${row.provider_surface}:${row.receipt_id}`;
          await resolveResearchFailure(tx, row.workspace_id, `purge:${rKey}`);
          await resolveResearchFailure(tx, row.workspace_id, 'purge:batch');
        }
        return claimed.rows.length;
      });
    } catch (err) {
      const code: ResearchFailureRecord['errorCode'] =
        err instanceof ResearchReceiptError && err.code === 'STORAGE_FAILURE'
          ? 'STORAGE_DELETE_FAILED'
          : 'AUDIT_UNAVAILABLE';
      for (const ws of workspaces) {
        await recordResearchFailure(this.db, ws, 'purge:batch', null, 'purge', code).catch(() => undefined);
      }
      if (err instanceof ResearchReceiptError) throw err;
      throw new ResearchReceiptError(
        code === 'AUDIT_UNAVAILABLE' ? 'AUDIT_UNAVAILABLE' : 'STORAGE_FAILURE',
        503,
      );
    }

    const remaining = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM research_capture_receipt
        WHERE workspace_id = ANY($1::text[])
          AND expires_at <= clock_timestamp()`,
      [workspaces],
    );
    return { purgedCount, remainingExpiredCount: Number(remaining.rows[0]?.count ?? '0') };
  }

  async inspectFailures(workspaceId: string): Promise<readonly ResearchFailureRecord[]> {
    this.requireWorkspaceAuthorized(workspaceId);
    const rows = await this.db.query<{
      workspace_id: string;
      receipt_key: string | null;
      stage: 'purge' | 'read';
      error_code: ResearchFailureRecord['errorCode'];
      attempts: number;
      first_failed_at: Date;
      last_failed_at: Date;
    }>(
      `SELECT workspace_id, receipt_key, stage, error_code, attempts, first_failed_at, last_failed_at
         FROM research_capture_failure
        WHERE workspace_id = $1 AND resolved_at IS NULL
        ORDER BY last_failed_at DESC`,
      [workspaceId],
    );
    return rows.rows.map((r) => Object.freeze({
      workspaceId: r.workspace_id,
      receiptKey: r.receipt_key,
      stage: r.stage,
      errorCode: r.error_code,
      attempts: r.attempts,
      firstFailedAt: r.first_failed_at.toISOString(),
      lastFailedAt: r.last_failed_at.toISOString(),
    }));
  }
}
