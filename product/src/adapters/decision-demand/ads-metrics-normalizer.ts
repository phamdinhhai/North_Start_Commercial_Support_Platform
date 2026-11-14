import { canonicalizePayload } from '../../domain/envelope/envelope';
import { isValidUnknownState, UNKNOWN_SENTINEL, type UnknownState } from '../../domain/unknown-states/unknown-states';

export type AdsProvider = 'google' | 'meta' | 'tiktok';
export type AdsValue = string | UnknownState;
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
  readonly currency: AdsValue;
  readonly timezone: AdsValue;
  readonly dateGranularity?: AdsValue;
  readonly attributionWindow: AdsValue;
  readonly occurredAt: AdsValue;
  readonly capturedAt: string;
  readonly nativeMetric: string;
  /** Provider/API version used to produce the observation; never inferred. */
  readonly sourceVersion?: AdsValue;
}

export interface NormalizedAdsMetric extends RawAdsMetric {
  readonly dateGranularity: AdsValue;
  readonly sourceVersion: AdsValue;
  readonly isSynthetic: true;
  readonly sourceSystem: AdsProvider;
  readonly unknownFields: readonly string[];
  readonly provenance: 'synthetic-read-only';
}

export interface AdsNormalizationResult {
  readonly observations: readonly NormalizedAdsMetric[];
  readonly diagnostics: readonly NormalizationDiagnostic[];
}

const providers: readonly AdsProvider[] = ['google', 'meta', 'tiktok'];
const requiredStrings: readonly (keyof RawAdsMetric)[] = [
  'workspaceId', 'providerAccountId', 'providerObjectId', 'metricName', 'capturedAt', 'nativeMetric',
];

/**
 * Normalize provider observations without assigning commercial meaning.
 * The identity is an encoded tuple, not a delimiter-joined string: every
 * component remains distinguishable even when it contains ':' or '\\'.
 */
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

    const dateGranularity = row.dateGranularity ?? UNKNOWN_SENTINEL;
    const sourceVersion = row.sourceVersion ?? UNKNOWN_SENTINEL;
    const key = JSON.stringify([
      row.workspaceId, row.provider, row.providerAccountId, row.providerObjectId,
      row.metricName, row.occurredAt, dateGranularity,
    ]);
    const fingerprint = canonicalizePayload({ ...row, dateGranularity, sourceVersion });
    const previous = seen.get(key);
    if (previous !== undefined) {
      diagnostics.add(previous === fingerprint ? 'DUPLICATE_RECORD' : 'CONFLICTING_RECORD');
      continue;
    }
    seen.set(key, fingerprint);

    const unknownFields = [
      ['currency', row.currency], ['timezone', row.timezone], ['dateGranularity', dateGranularity],
      ['attributionWindow', row.attributionWindow], ['occurredAt', row.occurredAt],
      ['sourceVersion', sourceVersion],
    ].filter(([, value]) => value === UNKNOWN_SENTINEL).map(([field]) => field);
    observations.push({
      ...row,
      dateGranularity,
      sourceVersion,
      isSynthetic: true,
      sourceSystem: row.provider,
      unknownFields,
      provenance: 'synthetic-read-only',
    });
  }
  return { observations, diagnostics: [...diagnostics].sort() };
}

function isValidRow(row: RawAdsMetric): boolean {
  if (!row || typeof row !== 'object' || !providers.includes(row.provider)) return false;
  if (requiredStrings.some((field) => typeof row[field] !== 'string' || row[field]!.length === 0)) return false;
  if (typeof row.value !== 'number' || !Number.isFinite(row.value)) return false;
  return [row.currency, row.timezone, row.dateGranularity, row.attributionWindow, row.occurredAt, row.sourceVersion]
    .every((value) => value === undefined || typeof value === 'string' && (value.length > 0 || isValidUnknownState(value)));
}
