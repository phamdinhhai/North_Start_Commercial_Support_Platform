import type { ContentDigest } from './content-digester';
import type { ResearchCipherMetadata } from './research-capture-crypto';

export const MAX_RESEARCH_RETENTION_DAYS = 7;

/**
 * Experimental raw intake; deliberately outside the CommercialEvent pipeline (ADR-009 §3, R3 A-04).
 * Raw bytes are carried across the in-process port boundary only so the server-side store can
 * authenticate, digest-verify and encrypt them at rest with AES-256-GCM before persisting.
 * Base64 is transport/boundary encoding only and is NEVER persisted as encryption.
 */
export interface ResearchReceipt {
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly accountId: string;
  readonly providerSurface: 'pancake-pos';
  readonly receiptId: string;
  readonly receivedAt: string;
  readonly payloadHash: string;
  readonly payloadDigest?: ContentDigest;
  readonly retentionDays: number;
  readonly rawBodyBase64?: string;
  readonly rawBody?: Uint8Array;
  readonly evidenceType: 'synthetic';
  readonly schemaStatus: 'uninterpreted';
}

export type ResearchReceiptAppendDisposition = 'stored' | 'duplicate' | 'conflict' | 'UNKNOWN';

export interface ResearchReceiptReadSelector {
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly accountId: string;
  readonly providerSurface: 'pancake-pos';
  readonly receiptId: string;
}

export interface StoredResearchReceiptMetadata extends ResearchReceiptReadSelector {
  readonly receivedAt: string;
  readonly acceptedAt: string;
  readonly expiresAt: string;
  readonly retentionDays: number;
  readonly payloadDigest: ContentDigest;
  readonly encryption: ResearchCipherMetadata;
  readonly evidenceType: 'synthetic';
  readonly schemaStatus: 'uninterpreted';
}

export type ResearchReceiptReadResult =
  | { readonly status: 'ok'; readonly metadata: StoredResearchReceiptMetadata; readonly rawBody: Uint8Array }
  | { readonly status: 'not_found' }
  | { readonly status: 'expired_denied'; readonly receiptId: string; readonly expiresAt: string }
  | {
      readonly status: 'UNKNOWN';
      readonly reason: 'ENCRYPTION_KEY_UNAVAILABLE' | 'DIGEST_KEY_UNAVAILABLE';
      readonly metadata: StoredResearchReceiptMetadata;
    };

export interface ResearchPurgeSummary {
  readonly purgedCount: number;
  readonly remainingExpiredCount: number;
}

export interface ResearchFailureRecord {
  readonly workspaceId: string;
  readonly receiptKey: string | null;
  readonly stage: 'purge' | 'read';
  readonly errorCode:
    | 'AUDIT_UNAVAILABLE'
    | 'STORAGE_DELETE_FAILED'
    | 'CIPHERTEXT_AUTH_FAILED'
    | 'DIGEST_MISMATCH';
  readonly attempts: number;
  readonly firstFailedAt: string;
  readonly lastFailedAt: string;
}

export class ResearchReceiptError extends Error {
  constructor(
    readonly code:
      | 'RESEARCH_CAPTURE_DISABLED'
      | 'RESEARCH_ONLY'
      | 'FORBIDDEN'
      | 'INVALID_RECEIPT'
      | 'PLAINTEXT_STORAGE_FORBIDDEN'
      | 'AUDIT_UNAVAILABLE'
      | 'STORAGE_FAILURE'
      | 'CIPHERTEXT_INTEGRITY_FAILED',
    readonly status: number,
  ) {
    super(code);
  }
}

export interface ResearchReceiptPort {
  /**
   * Atomically append encrypted-at-rest before resolving. Scope the unique receipt key by workspace,
   * connection, account and surface. Trusted DB acceptance time fixes `expires_at <= accepted_at + 7 days`;
   * duplicate deliveries NEVER extend `expires_at`. Same key + changed digest returns `conflict`;
   * same key + retired/missing old digest key returns `UNKNOWN` (I-08).
   * A receipt ID identifies a local delivery, never an inferred provider event ID.
   */
  append(receipt: ResearchReceipt): Promise<ResearchReceiptAppendDisposition>;
}

export interface EncryptedResearchReceiptStore extends ResearchReceiptPort {
  read(selector: ResearchReceiptReadSelector, actorId: string): Promise<ResearchReceiptReadResult>;
  purgeExpired(actorId?: string, batchLimit?: number): Promise<ResearchPurgeSummary>;
  inspectFailures(workspaceId: string): Promise<readonly ResearchFailureRecord[]>;
}
