import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';

export type AdsProvider = 'google' | 'meta' | 'tiktok';
export type NormalizationDiagnostic =
  | 'MALFORMED_INPUT'
  | 'DUPLICATE_RECORD'
  | 'CONFLICTING_RECORD'
  | 'CROSS_WORKSPACE_RECORD';

export interface RawAdsMetric {
  readonly workspaceId: string;
  readonly provider: AdsProvider;
  readonly providerAccountId: string;
  readonly providerObjectId: string;
  readonly metricName: string;
  readonly value: number;
  readonly currency: string | typeof UNKNOWN_SENTINEL;
  readonly timezone: string | typeof UNKNOWN_SENTINEL;
  readonly attributionWindow: string | typeof UNKNOWN_SENTINEL;
  readonly occurredAt: string | typeof UNKNOWN_SENTINEL;
  readonly capturedAt: string;
  readonly nativeMetric: string;
}

export interface NormalizedAdsMetric extends RawAdsMetric {
  readonly isSynthetic: true;
  readonly sourceSystem: AdsProvider;
  readonly unknownFields: readonly string[];
  readonly provenance: 'synthetic-read-only';
}

export interface AdsNormalizationResult {
  readonly observations: readonly NormalizedAdsMetric[];
  readonly diagnostics: readonly NormalizationDiagnostic[];
}

const requiredStrings: readonly (keyof RawAdsMetric)[] = [
  'workspaceId', 'providerAccountId', 'providerObjectId', 'metricName', 'capturedAt', 'nativeMetric',
];

export function normalizeSyntheticAdsMetrics(
  expectedWorkspaceId: string,
  rows: readonly RawAdsMetric[],
): AdsNormalizationResult {
  const observations: NormalizedAdsMetric[] = [];
  const diagnostics = new Set<NormalizationDiagnostic>();
  const seen = new Map<string, string>();

  for (const row of rows) {
    if (!isValidRow(row)) {
      diagnostics.add('MALFORMED_INPUT');
      continue;
    }
    if (row.workspaceId !== expectedWorkspaceId) {
      diagnostics.add('CROSS_WORKSPACE_RECORD');
      continue;
    }
    const key = `${row.provider}:${row.providerAccountId}:${row.providerObjectId}:${row.metricName}:${row.occurredAt}`;
    const fingerprint = JSON.stringify(row);
    const previous = seen.get(key);
    if (previous !== undefined) {
      diagnostics.add(previous === fingerprint ? 'DUPLICATE_RECORD' : 'CONFLICTING_RECORD');
      continue;
    }
    seen.set(key, fingerprint);
    const unknownFields = [
      ['currency', row.currency], ['timezone', row.timezone],
      ['attributionWindow', row.attributionWindow], ['occurredAt', row.occurredAt],
    ].filter(([, value]) => value === UNKNOWN_SENTINEL).map(([field]) => field);
    observations.push({ ...row, isSynthetic: true, sourceSystem: row.provider, unknownFields, provenance: 'synthetic-read-only' });
  }
  return { observations, diagnostics: [...diagnostics].sort() };
}

function isValidRow(row: RawAdsMetric): boolean {
  if (!row || typeof row !== 'object') return false;
  if (!['google', 'meta', 'tiktok'].includes(row.provider)) return false;
  if (requiredStrings.some((field) => typeof row[field] !== 'string' || row[field].length === 0)) return false;
  if (typeof row.value !== 'number' || !Number.isFinite(row.value)) return false;
  if (!['string', 'unknown'].includes(typeof row.currency)
    || !['string', 'unknown'].includes(typeof row.timezone)
    || !['string', 'unknown'].includes(typeof row.attributionWindow)
    || !['string', 'unknown'].includes(typeof row.occurredAt)) return false;
  return true;
}
