/**
 * Read-only provider boundary used by the R4.14 fabricated connector slices.
 * It deliberately does not contain credentials, HTTP clients or mutation verbs.
 */
export type HybridProvider = 'pancake' | 'tiktok-business' | 'zalo-oa';
export type ProviderErrorClass =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'RATE_LIMITED'
  | 'POLICY_WINDOW'
  | 'SCHEMA_DRIFT'
  | 'TRANSPORT'
  | 'UNKNOWN';

export interface ProviderContext {
  readonly provider: HybridProvider;
  readonly accountId: string;
  readonly pageId: string | null;
  readonly nativeObjectId: string;
  readonly surface: 'conversation' | 'ad-account' | 'oa-inbox';
  readonly observedAt: string;
}

export interface ReadOnlyObservation {
  readonly schemaVersion: 1;
  readonly provider: HybridProvider;
  readonly route: 'pancake-read' | 'tiktok-read' | 'zalo-read';
  readonly synthetic: true;
  readonly sourceAuthority: 'synthetic_fixture';
  readonly verification: 'UNVERIFIED';
  readonly completeness: 'UNKNOWN';
  readonly context: ProviderContext;
  readonly native: { readonly objectId: string; readonly revision: string | null };
  readonly raw: { readonly kind: string; readonly fields: Readonly<Record<string, unknown>> };
}

export interface ReadOnlyProviderAdapter {
  readonly provider: HybridProvider;
  recognize(input: unknown): ProviderContext;
  observe(input: unknown): ReadOnlyObservation;
  classifyError(input: unknown): ProviderErrorClass;
}

export const PROVIDER_ROUTES: Readonly<Record<HybridProvider, ReadOnlyObservation['route']>> = {
  pancake: 'pancake-read',
  'tiktok-business': 'tiktok-read',
  'zalo-oa': 'zalo-read',
};

export function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`INVALID_${name.toUpperCase()}`);
  }
  return value;
}

export function timestamp(value: unknown): string {
  const result = text(value, 'observed_at');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(result) ||
      new Date(result).toISOString() !== result) throw new Error('INVALID_OBSERVED_AT');
  return result;
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_PROVIDER_FIXTURE');
  return value as Record<string, unknown>;
}

export function classifyProviderError(value: unknown): ProviderErrorClass {
  const input = object(value);
  const status = input.status;
  if (status === 401) return 'AUTHENTICATION';
  if (status === 403) return 'AUTHORIZATION';
  if (status === 429) return 'RATE_LIMITED';
  const code = typeof input.code === 'string' ? input.code.toUpperCase() : '';
  if (code === 'MESSAGING_WINDOW_EXPIRED' || code === 'META_ERROR_10') return 'POLICY_WINDOW';
  if (code === 'SCHEMA_DRIFT') return 'SCHEMA_DRIFT';
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET') return 'TRANSPORT';
  if (input.success === false && typeof input.message_code === 'string' && /window|policy/u.test(input.message_code)) return 'POLICY_WINDOW';
  return 'UNKNOWN';
}

export function observation(adapter: ReadOnlyProviderAdapter, context: ProviderContext, kind: string, fields: Record<string, unknown>): ReadOnlyObservation {
  return {
    schemaVersion: 1,
    provider: adapter.provider,
    route: PROVIDER_ROUTES[adapter.provider],
    synthetic: true,
    sourceAuthority: 'synthetic_fixture',
    verification: 'UNVERIFIED',
    completeness: 'UNKNOWN',
    context,
    native: { objectId: context.nativeObjectId, revision: null },
    raw: { kind, fields: structuredClone(fields) },
  };
}
