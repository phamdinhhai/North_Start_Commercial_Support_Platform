import { createHash, timingSafeEqual } from 'node:crypto';
import {
  MAX_RESEARCH_RETENTION_DAYS,
  type ResearchReceiptPort,
} from '../../ports/research-receipt.port';
import type { ContentDigest, ContentDigester } from './content-digester';
import { validId, validTime, validateScope, type ObservationScope } from './observation';

export { MAX_RESEARCH_RETENTION_DAYS } from '../../ports/research-receipt.port';

/**
 * ADR-009 §3 / R3 A-04: raw bodies are retained only under an explicit research-capture grant for one
 * authorized workspace, with at most 7 days retention. The sink behind `ResearchReceiptPort` enforces
 * server-side AES-256-GCM encryption at rest, trusted DB acceptance expiry, automatic purge and audit.
 * Base64 is boundary transport only and is never treated or persisted as encryption.
 */
export interface ResearchCaptureFlag {
  readonly enabled: true;
  readonly authorizedWorkspaceId: string;
  readonly retentionDays: number;
}

export interface PosFixtureOptions {
  readonly digester: ContentDigester;
  readonly researchCapture: ResearchCaptureFlag;
}

export interface FixtureDelivery {
  readonly configuredSecretHeader: unknown;
  readonly receiptId: string;
  readonly receivedAt: string;
  readonly rawBody: Uint8Array;
}

/**
 * Synthetic-only receiver harness, with no HTTP route or provider credentials.
 * Official docs specify configured headers, not an HMAC signature contract.
 * The order/customer schemas omit fields in the retrieved docs: retain bytes
 * without guessing an event ID, version, shop mapping or commercial meaning.
 */
export class PosWebhookFixtureReceiver {
  private readonly scope: ObservationScope;
  private readonly secretHash: Buffer;
  private readonly digester: ContentDigester;
  private readonly retentionDays: number;

  constructor(scope: ObservationScope, fixtureSecret: string, private readonly receipts: ResearchReceiptPort, options: PosFixtureOptions) {
    validateScope(scope);
    if (scope.providerSurface !== 'pancake-pos') throw new Error('unsupported_surface');
    const flag = options?.researchCapture;
    if (!flag || flag.enabled !== true || flag.authorizedWorkspaceId !== scope.workspaceId || !Number.isSafeInteger(flag.retentionDays) ||
        flag.retentionDays < 1 || flag.retentionDays > MAX_RESEARCH_RETENTION_DAYS) throw new Error('research_capture_not_authorized');
    if (!options.digester || typeof options.digester.digest !== 'function') throw new Error('digester_required');
    this.digester = options.digester;
    this.retentionDays = flag.retentionDays;
    if (typeof fixtureSecret !== 'string' || fixtureSecret.length < 32 || fixtureSecret.length > 1024) throw new Error('invalid_fixture_secret');
    this.scope = { ...scope };
    this.secretHash = digest(fixtureSecret);
  }

  async receive(delivery: FixtureDelivery): Promise<{ status: 202 | 400 | 401 | 409 | 413 | 503; result: string }> {
    const supplied = delivery.configuredSecretHeader;
    if (typeof supplied !== 'string' || supplied.length > 1024 || !timingSafeEqual(digest(supplied), this.secretHash)) {
      return { status: 401, result: 'invalid_source_header' };
    }
    if (!validId(delivery.receiptId) || !validTime(delivery.receivedAt) || !(delivery.rawBody instanceof Uint8Array)) {
      return { status: 400, result: 'malformed_delivery' };
    }
    if (delivery.rawBody.byteLength > 262144) return { status: 413, result: 'body_limit' };
    const raw = Buffer.from(delivery.rawBody);
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { status: 400, result: 'invalid_json_object' };
    } catch { return { status: 400, result: 'invalid_json_object' }; }
    try {
      const keyedDigest: ContentDigest = this.digester.digest(this.scope.workspaceId, 'receipt', raw);
      const result = await this.receipts.append({
        ...this.scope,
        providerSurface: 'pancake-pos',
        receiptId: delivery.receiptId,
        receivedAt: delivery.receivedAt,
        payloadHash: formatReceiptDigest(keyedDigest),
        payloadDigest: keyedDigest,
        retentionDays: this.retentionDays,
        rawBody: Uint8Array.from(raw),
        rawBodyBase64: raw.toString('base64'),
        evidenceType: 'synthetic',
        schemaStatus: 'uninterpreted',
      });
      if (result === 'conflict') return { status: 409, result };
      if (result === 'UNKNOWN') return { status: 503, result: 'UNKNOWN' };
      if (result !== 'stored' && result !== 'duplicate') return { status: 503, result: 'persistence_unconfirmed' };
      return { status: 202, result };
    } catch { return { status: 503, result: 'persistence_unconfirmed' }; }
  }
}

// Fixed-length comparison of the configured header only (not customer content).
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/** Self-describing keyed digest (`hmac-sha256:<kid>:<hex>`) alongside structured `payloadDigest`. */
function formatReceiptDigest(keyed: ContentDigest): string {
  return `hmac-sha256:${keyed.kid}:${keyed.value}`;
}
