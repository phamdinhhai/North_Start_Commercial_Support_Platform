import { createHash } from 'node:crypto';

export interface ObservationScope {
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly accountId: string;
  readonly providerSurface: 'pancake-conversations' | 'pancake-pos';
}

/** Research evidence, not a CommercialEvent or an assertion of provider success. */
export interface Observation {
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
  readonly payloadHash: string;
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

export function hashBytes(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function validateObservation(value: Observation): void {
  validateScope(value.scope);
  if (!validId(value.captureId) || !validId(value.sourceRevision) || !validId(value.eventType) ||
      !validTime(value.observedAt) || !/^[a-f0-9]{64}$/.test(value.payloadHash) ||
      (value.externalEventId !== null && !validId(value.externalEventId)) ||
      (value.externalObjectId !== null && !validId(value.externalObjectId)) ||
      !['browser-websocket', 'pos-webhook-fixture'].includes(value.method) ||
      value.authenticity !== 'UNKNOWN' || value.completeness !== 'UNKNOWN' || value.occurredAt !== null ||
      (value.method === 'browser-websocket' && (value.evidenceType !== 'client-observed' || value.scope.providerSurface !== 'pancake-conversations')) ||
      (value.method === 'pos-webhook-fixture' && (value.evidenceType !== 'synthetic' || value.scope.providerSurface !== 'pancake-pos'))) {
    throw new Error('invalid_observation');
  }
}
