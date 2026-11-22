import { createHash, timingSafeEqual } from 'node:crypto';
import type { ResearchReceiptPort } from '../../ports/research-receipt.port';
import type { ContentDigester } from './content-digester';
import { validId, validTime, validateScope, type ObservationScope } from './observation';

/**
 * ADR-009 §3: raw bodies are retained only under an explicit research-capture grant for one authorized workspace,
 * with at most 7 days retention. Encryption at rest, automatic deletion and audit are obligations of the sink
 * behind ResearchReceiptPort; no such storage is built here. Without this flag the receiver refuses to start.
 */
export interface ResearchCaptureFlag {
  readonly enabled: true;
  readonly authorizedWorkspaceId: string;
  readonly retentionDays: number;
}

export const MAX_RESEARCH_RETENTION_DAYS = 7;

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

  constructor(scope: ObservationScope, fixtureSecret: string, private readonly receipts: ResearchReceiptPort, options: PosFixtureOptions) {
    validateScope(scope);
    if (scope.providerSurface !== 'pancake-pos') throw new Error('unsupported_surface');
    const flag = options?.researchCapture;
    if (!flag || flag.enabled !== true || flag.authorizedWorkspaceId !== scope.workspaceId || !Number.isSafeInteger(flag.retentionDays) ||
        flag.retentionDays < 1 || flag.retentionDays > MAX_RESEARCH_RETENTION_DAYS) throw new Error('research_capture_not_authorized');
    if (!options.digester || typeof options.digester.digest !== 'function') throw new Error('digester_required');
    this.digester = options.digester;
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
      const result = await this.receipts.append({
        ...this.scope, providerSurface: 'pancake-pos', receiptId: delivery.receiptId,
        receivedAt: delivery.receivedAt, payloadHash: receiptDigest(this.digester, this.scope.workspaceId, raw),
        rawBodyBase64: raw.toString('base64'), evidenceType: 'synthetic', schemaStatus: 'uninterpreted',
      });
      if (result === 'conflict') return { status: 409, result };
      if (result !== 'stored' && result !== 'duplicate') return { status: 503, result: 'persistence_unconfirmed' };
      return { status: 202, result };
    } catch { return { status: 503, result: 'persistence_unconfirmed' }; }
  }
}

// Fixed-length comparison of the configured header only (not customer content).
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/** Self-describing keyed digest (`hmac-sha256:<kid>:<hex>`) so the port records the kid beside the value. */
function receiptDigest(digester: ContentDigester, workspaceId: string, raw: Buffer): string {
  const keyed = digester.digest(workspaceId, 'receipt', raw);
  return `hmac-sha256:${keyed.kid}:${keyed.value}`;
}
