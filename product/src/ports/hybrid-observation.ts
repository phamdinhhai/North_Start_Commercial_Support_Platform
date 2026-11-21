/**
 * Adapter-neutral R4.14 observation contract. This is a technical receipt
 * envelope, not a CommercialEvent, Lead, Customer, or provider mutation.
 * Real-data admission remains disabled; all current callers must use fixtures.
 */
export type HybridProvider = 'pancake' | 'meta_ads' | 'hubspot';
export type ObservationAuthority = 'browser_dom' | 'browser_network' | 'official_api' | 'official_webhook' | 'user_export';
export type ObservationTrust = 'UNVERIFIED' | 'AUTHENTICATED_TRANSPORT' | 'PROVIDER_OBSERVED';
export interface HybridNativeIdentity {
  readonly system: HybridProvider;
  readonly accountId: string;
  readonly objectType: 'conversation' | 'message' | 'campaign' | 'adset' | 'ad' | 'contact' | 'company' | 'deal';
  readonly objectId: string;
  readonly parentId: string | null;
}
export interface HybridObservationEnvelope {
  readonly schemaVersion: 1;
  readonly fixture: true;
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly observationId: string;
  readonly authority: ObservationAuthority;
  readonly trust: ObservationTrust;
  readonly native: HybridNativeIdentity;
  readonly capturedAt: string;
  /** Digest of the minimized observation, never a body-derived browser identity. */
  readonly payloadDigest: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
export interface HybridObservationReceipt {
  readonly observationId: string;
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly nativeKey: string;
  readonly authority: ObservationAuthority;
  readonly trust: ObservationTrust;
  readonly disposition: 'stored' | 'duplicate' | 'conflict' | 'scope_rejected';
  readonly completeness: 'UNKNOWN';
}
const authorities: readonly ObservationAuthority[] = ['browser_dom', 'browser_network', 'official_api', 'official_webhook', 'user_export'];
const providers: readonly HybridProvider[] = ['pancake', 'meta_ads', 'hubspot'];
const objectTypes: readonly HybridNativeIdentity['objectType'][] = ['conversation', 'message', 'campaign', 'adset', 'ad', 'contact', 'company', 'deal'];
const text = (v: unknown, max = 256): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\x00-\x1f\x7f]/u.test(v);
const iso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function nativeObservationKey(native: HybridNativeIdentity): string {
  // Length-delimited JSON prevents IDs containing ':' from colliding with tuple boundaries.
  return JSON.stringify([native.system, native.accountId, native.objectType, native.objectId, native.parentId ?? null]);
}
export function validateHybridObservation(value: unknown, scope: { workspaceId: string; connectionId: string }): HybridObservationEnvelope {
  const envelopeKeys = 'authority,capturedAt,connectionId,fixture,observationId,payload,payloadDigest,schemaVersion,trust,workspaceId,native'.split(',');
  if (!obj(value) || Object.keys(value).sort().join(',') !== envelopeKeys.sort().join(',') || value.schemaVersion !== 1 || value.fixture !== true ||
    !text(value.workspaceId) || value.workspaceId !== scope.workspaceId ||
    !text(value.connectionId) || value.connectionId !== scope.connectionId ||
    !text(value.observationId) || !authorities.includes(value.authority as ObservationAuthority) ||
    !['UNVERIFIED', 'AUTHENTICATED_TRANSPORT', 'PROVIDER_OBSERVED'].includes(value.trust as string) ||
    !iso(value.capturedAt) || !digest(value.payloadDigest) || !obj(value.payload) || !obj(value.native)) throw new Error('HYBRID_OBSERVATION_INVALID');
  const n = value.native as Record<string, unknown>;
  if (Object.keys(n).sort().join(',') !== 'accountId,objectId,objectType,parentId,system') throw new Error('HYBRID_NATIVE_ID_INVALID');
  if (!providers.includes(n.system as HybridProvider) || !objectTypes.includes(n.objectType as HybridNativeIdentity['objectType']) ||
    !text(n.accountId) || !text(n.objectId) || (n.parentId !== null && !text(n.parentId))) throw new Error('HYBRID_NATIVE_ID_INVALID');
  if (['browser_dom', 'browser_network'].includes(value.authority as string) && value.trust !== 'UNVERIFIED') throw new Error('BROWSER_TRUST_ESCALATION');
  return structuredClone(value) as unknown as HybridObservationEnvelope;
}
export function reconcileHybridObservation(current: HybridObservationEnvelope | null, incoming: HybridObservationEnvelope, scope: { workspaceId: string; connectionId: string }): HybridObservationReceipt {
  const checked = validateHybridObservation(incoming, scope);
  const nativeKey = nativeObservationKey(checked.native);
  if (current && (current.workspaceId !== scope.workspaceId || current.connectionId !== scope.connectionId)) return { observationId: checked.observationId, workspaceId: scope.workspaceId, connectionId: scope.connectionId, nativeKey, authority: checked.authority, trust: checked.trust, disposition: 'scope_rejected', completeness: 'UNKNOWN' };
  if (!current) return { observationId: checked.observationId, workspaceId: scope.workspaceId, connectionId: scope.connectionId, nativeKey, authority: checked.authority, trust: checked.trust, disposition: 'stored', completeness: 'UNKNOWN' };
  if (nativeObservationKey(current.native) !== nativeKey) return { observationId: checked.observationId, workspaceId: scope.workspaceId, connectionId: scope.connectionId, nativeKey, authority: checked.authority, trust: checked.trust, disposition: 'conflict', completeness: 'UNKNOWN' };
  return { observationId: checked.observationId, workspaceId: scope.workspaceId, connectionId: scope.connectionId, nativeKey, authority: checked.authority, trust: checked.trust, disposition: current.payloadDigest === checked.payloadDigest ? 'duplicate' : 'conflict', completeness: 'UNKNOWN' };
}
