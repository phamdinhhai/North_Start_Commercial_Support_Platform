import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { PostgresService } from '../postgres/postgres.service';
import type { ProductEvent, RecordEventInput, TelemetryServicePort } from '../../ports/telemetry';
export type { ProductEvent, RecordEventInput } from '../../ports/telemetry';

/**
 * ProductEvent telemetry (R-21/R-22, C-07/C-08) — tagged releaseVersion + flag exposure.
 * Feedback (R-23) là bảng riêng; không gộp vào payload.
 * Persist only bounded telemetry metadata; sanitize payload and validate all tags at this boundary (QA-36/38).
 */
interface ProductEventDbRow extends QueryResultRow {
  id: string;
  workspace_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  release_version: string;
  flag_exposure: Record<string, string>;
  created_at: Date | string;
}

const COLUMNS = 'id, workspace_id, event_type, payload, release_version, flag_exposure, created_at';

/** Maximum serialized telemetry payload size persisted by this service. */
export const MAX_TELEMETRY_PAYLOAD_BYTES = 8 * 1024;
const SENSITIVE_KEY = /(token|secret|password|auth|cookie|e.?mail|phone|mobile|telephone|ssn|social.?security|credit.?card|card.?number|cvv|api.?key|access.?key|private.?key|credential|passcode|otp|address|ip.?address|pii|bearer|session|jwt|message|prompt|content|evidence|lead.?id|customer.?id)/i;
const REDACTED = '[REDACTED]';
const TRUNCATED = { _truncated: true, _reason: 'payload_size_limit' };
const PAYLOAD_LIMIT = Symbol('telemetry payload limit');
const MAX_DEPTH = 8;
const MAX_NODES = 256;
const MAX_COLLECTION_ITEMS = 64;
const SAFE_KEY = /^[a-z][a-z0-9_]{0,63}$/i;
const PAYLOAD_KEYS = new Set(['nested', 'safe', 'details']);
// Known product event/flag identifiers only. New identifiers require an explicit privacy review.
const EVENT_TYPES = new Set(['lead_viewed']);
const FLAG_VARIANTS: Readonly<Record<string, ReadonlySet<string>>> = {
  pancake_sync: new Set(['on', 'off']),
};
const SAFE_PAYLOAD_VALUES = new Set(['ok', 'on', 'off', 'unknown']);
const MAX_FLAGS = 16;
const MAX_TAG_BYTES = 64;
const MAX_FLAG_BYTES = 1024;
const RELEASE_VERSION = /^(?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5})$/;
const WORKSPACE_ID = /^(?:ws-[a-z0-9_-]{1,30}|bootstrap|demo:[a-z0-9_-]{1,30}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function validTag(value: unknown, pattern: RegExp, maxBytes: number): value is string {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maxBytes
    && pattern.test(value) && !SENSITIVE_KEY.test(value);
}

/**
 * Pure telemetry boundary sanitizer. Only a tiny fixed categorical string vocabulary
 * survives: identifiers, free text, URLs and unrecognized values are never persisted.
 * Depth, collection count, node count, cycles and serialized bytes are bounded.
 */
export function redactTelemetryPayload(
  payload: Record<string, unknown>,
  maxBytes = MAX_TELEMETRY_PAYLOAD_BYTES,
): Record<string, unknown> {
  if (!Number.isInteger(maxBytes) || maxBytes < 32 || maxBytes > MAX_TELEMETRY_PAYLOAD_BYTES) {
    throw new Error('maxBytes must be between 32 and MAX_TELEMETRY_PAYLOAD_BYTES');
  }
  const state = { nodes: 0, seen: new WeakSet<object>() };
  try {
    const sanitized = sanitizeValue(payload, state, 0);
    if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return TRUNCATED;
    if (Buffer.byteLength(JSON.stringify(sanitized), 'utf8') > maxBytes) return TRUNCATED;
    return sanitized as Record<string, unknown>;
  } catch (error) {
    if (error === PAYLOAD_LIMIT) return TRUNCATED;
    throw error;
  }
}

function sanitizeValue(value: unknown, state: { nodes: number; seen: WeakSet<object> }, depth: number): unknown {
  if (++state.nodes > MAX_NODES || depth > MAX_DEPTH) throw PAYLOAD_LIMIT;
  if (typeof value === 'string') return SAFE_PAYLOAD_VALUES.has(value) ? value : REDACTED;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 0 || value === 1 ? value : REDACTED;
  if (!value || typeof value !== 'object') return REDACTED;
  if (state.seen.has(value)) throw PAYLOAD_LIMIT;
  state.seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_COLLECTION_ITEMS) throw PAYLOAD_LIMIT;
    return Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      return descriptor && 'value' in descriptor ? sanitizeValue(descriptor.value, state, depth + 1) : REDACTED;
    });
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return REDACTED;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length > MAX_COLLECTION_ITEMS) throw PAYLOAD_LIMIT;
  const output: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (!SAFE_KEY.test(key) || SENSITIVE_KEY.test(key) || !PAYLOAD_KEYS.has(key)) {
      // Never retain attacker-controlled field names (which can themselves contain PII).
      output._redacted_key = REDACTED;
      continue;
    }
    const descriptor = descriptors[key];
    output[key] = descriptor && 'value' in descriptor
      ? sanitizeValue(descriptor.value, state, depth + 1)
      : REDACTED;
  }
  return output;
}

function validateFlags(flags: unknown): Record<string, string> {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)
      || (Object.getPrototypeOf(flags) !== Object.prototype && Object.getPrototypeOf(flags) !== null)) {
    throw new Error('flagExposure must be a plain object');
  }
  const entries = Object.entries(Object.getOwnPropertyDescriptors(flags));
  if (entries.length > MAX_FLAGS) throw new Error('flagExposure exceeds limit');
  const safe: Record<string, string> = Object.create(null);
  for (const [name, descriptor] of entries) {
    if (!validTag(name, SAFE_KEY, MAX_TAG_BYTES) || !Object.hasOwn(FLAG_VARIANTS, name)
        || !('value' in descriptor) || typeof descriptor.value !== 'string'
        || !FLAG_VARIANTS[name].has(descriptor.value)) {
      throw new Error('flagExposure contains an unapproved flag or variant');
    }
    safe[name] = descriptor.value;
  }
  if (Buffer.byteLength(JSON.stringify(safe), 'utf8') > MAX_FLAG_BYTES) throw new Error('flagExposure exceeds limit');
  return safe;
}

@Injectable()
export class TelemetryService implements TelemetryServicePort {
  constructor(private readonly db: PostgresService) {}

  async record(input: RecordEventInput): Promise<ProductEvent> {
    if (!input.workspaceId) throw new Error('workspaceId is required');
    if (!validTag(input.workspaceId, WORKSPACE_ID, MAX_TAG_BYTES)) throw new Error('workspaceId is invalid');
    if (!input.eventType) throw new Error('eventType is required');
    if (!validTag(input.eventType, SAFE_KEY, MAX_TAG_BYTES) || !EVENT_TYPES.has(input.eventType)) {
      throw new Error('eventType is not approved');
    }
    const releaseVersion = input.releaseVersion ?? process.env.npm_package_version ?? '0.1.0';
    if (!validTag(releaseVersion, RELEASE_VERSION, MAX_TAG_BYTES)) throw new Error('releaseVersion is invalid');
    const flagExposure = validateFlags(input.flagExposure ?? {});
    const payload = redactTelemetryPayload(input.payload ?? {});
    const result = await this.db.query<ProductEventDbRow>(
      `INSERT INTO product_event (workspace_id, event_type, payload, release_version, flag_exposure)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb) RETURNING ${COLUMNS}`,
      [input.workspaceId, input.eventType, JSON.stringify(payload), releaseVersion, JSON.stringify(flagExposure)],
    );
    return toEvent(result.rows[0]);
  }

  async listByWorkspace(workspaceId: string): Promise<readonly ProductEvent[]> {
    const result = await this.db.query<ProductEventDbRow>(
      `SELECT ${COLUMNS} FROM product_event WHERE workspace_id = $1 ORDER BY created_at`,
      [workspaceId],
    );
    return result.rows.map(toEvent);
  }
}

function toEvent(r: ProductEventDbRow): ProductEvent {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    eventType: r.event_type,
    payload: r.payload,
    releaseVersion: r.release_version,
    flagExposure: r.flag_exposure,
    createdAt: new Date(r.created_at).toISOString(),
  };
}
