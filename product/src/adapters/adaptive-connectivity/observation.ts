import { validContentDigest, type ContentDigest } from './content-digester';

export interface ObservationScope {
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly accountId: string;
  readonly providerSurface: 'pancake-conversations' | 'pancake-pos';
}

/**
 * Metadata contract shared by the browser companion and the server upload (ADR-009). It carries no
 * content-derived value: the browser never sends a body digest, and the server cannot recompute one.
 */
export interface ObservationMetadata {
  readonly scope: ObservationScope;
  readonly captureId: string;
  readonly sourceRevision: string;
  readonly externalEventId: string | null;
  readonly externalObjectId: string | null;
  readonly eventType: string;
  readonly method: 'browser-websocket' | 'pos-webhook-fixture';
  readonly evidenceType: 'client-observed' | 'synthetic';
  readonly authenticity: 'UNKNOWN';
  readonly completeness: 'UNKNOWN';
  readonly occurredAt: null;
  readonly observedAt: string;
}

/** Research evidence, not a CommercialEvent or an assertion of provider success. Server-side observers only. */
export interface Observation extends ObservationMetadata {
  /** ADR-009 keyed HMAC of the received frame under the workspace key; comparable only within the same kid. */
  readonly payloadDigest: ContentDigest;
}

export const OBSERVATION_METADATA_KEYS: readonly (keyof ObservationMetadata)[] = Object.freeze(['scope', 'captureId', 'sourceRevision',
  'externalEventId', 'externalObjectId', 'eventType', 'method', 'evidenceType', 'authenticity', 'completeness', 'occurredAt', 'observedAt']);

/** The browser/server parity view of a server-side observation: the keyed digest never leaves the server. */
export function observationMetadata(observation: Observation): ObservationMetadata {
  const result: Record<string, unknown> = {};
  for (const key of OBSERVATION_METADATA_KEYS) result[key] = key === 'scope' ? { ...observation.scope } : observation[key];
  return result as unknown as ObservationMetadata;
}

export function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f]/.test(value);
}

export function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && Number.isFinite(Date.parse(value));
}

export function validateScope(scope: ObservationScope): void {
  if (!scope || !validId(scope.workspaceId) || !validId(scope.connectionId) || !validId(scope.accountId) ||
      !['pancake-conversations', 'pancake-pos'].includes(scope.providerSurface)) throw new Error('invalid_scope');
}

export function scopeKey(scope: ObservationScope): string {
  validateScope(scope);
  return JSON.stringify([scope.workspaceId, scope.connectionId, scope.accountId, scope.providerSurface]);
}

export function validateObservation(value: Observation): void {
  validateScope(value.scope);
  if (!validId(value.captureId) || !validId(value.sourceRevision) || !validId(value.eventType) ||
      !validTime(value.observedAt) || !validContentDigest(value.payloadDigest) ||
      (value.externalEventId !== null && !validId(value.externalEventId)) ||
      (value.externalObjectId !== null && !validId(value.externalObjectId)) ||
      !['browser-websocket', 'pos-webhook-fixture'].includes(value.method) ||
      value.authenticity !== 'UNKNOWN' || value.completeness !== 'UNKNOWN' || value.occurredAt !== null ||
      (value.method === 'browser-websocket' && (value.evidenceType !== 'client-observed' || value.scope.providerSurface !== 'pancake-conversations')) ||
      (value.method === 'pos-webhook-fixture' && (value.evidenceType !== 'synthetic' || value.scope.providerSurface !== 'pancake-pos'))) {
    throw new Error('invalid_observation');
  }
}
