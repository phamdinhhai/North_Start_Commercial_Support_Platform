import { canonicalizePayload } from '../../domain/envelope/envelope';
import { isValidUnknownState, UNKNOWN_SENTINEL, type UnknownState } from '../../domain/unknown-states/unknown-states';

export type AdsProvider = 'google' | 'meta' | 'tiktok';
export type AdsValue = string | UnknownState;
export type AdsDateGranularity = 'hour' | 'day' | 'week' | 'month' | 'lifetime' | UnknownState;
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
  readonly dateGranularity?: AdsDateGranularity;
  readonly attributionWindow: AdsValue;
  readonly occurredAt: AdsValue;
  readonly capturedAt: string;
  readonly nativeMetric: string;
  /** Provider/API version used to produce the observation; never inferred. */
  readonly sourceVersion?: AdsValue;
  /** Provider surface or endpoint family (e.g. data-manager-api, marketing-api); never inferred. */
  readonly providerSurface?: AdsValue;
}

export interface NormalizedAdsMetric extends RawAdsMetric {
  readonly dateGranularity: AdsDateGranularity;
  readonly sourceVersion: AdsValue;
  readonly providerSurface: AdsValue;
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
const granularities = new Set<string>(['hour', 'day', 'week', 'month', 'lifetime']);
const requiredStrings: readonly (keyof RawAdsMetric)[] = [
  'workspaceId', 'providerAccountId', 'providerObjectId', 'metricName', 'capturedAt', 'nativeMetric',
];

/**
 * Normalize provider observations without assigning commercial meaning or revenue credit (MM-1 OPEN).
 * Identity uses an injective JSON tuple over workspace, provider, account, object, native/canonical
 * metric, occurredAt, dateGranularity and attributionWindow so distinct windows or granularities do
 * not collide while conflicting values for the same slice are quarantined.
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
    const providerSurface = row.providerSurface ?? UNKNOWN_SENTINEL;
    const key = JSON.stringify([
      row.workspaceId,
      row.provider,
      row.providerAccountId,
      row.providerObjectId,
      row.metricName,
      row.nativeMetric,
      row.occurredAt,
      dateGranularity,
      row.attributionWindow,
    ]);
    const fingerprint = canonicalizePayload({ ...row, dateGranularity, sourceVersion, providerSurface });
    const previous = seen.get(key);
    if (previous !== undefined) {
      diagnostics.add(previous === fingerprint ? 'DUPLICATE_RECORD' : 'CONFLICTING_RECORD');
      continue;
    }
    seen.set(key, fingerprint);

    const unknownFields = [
      ['currency', row.currency],
      ['timezone', row.timezone],
      ['dateGranularity', dateGranularity],
      ['attributionWindow', row.attributionWindow],
      ['occurredAt', row.occurredAt],
      ['sourceVersion', sourceVersion],
      ['providerSurface', providerSurface],
    ].filter(([, value]) => isValidUnknownState(value)).map(([field]) => field);

    observations.push({
      ...row,
      dateGranularity,
      sourceVersion,
      providerSurface,
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
  if (requiredStrings.some((field) => typeof row[field] !== 'string' || (row[field] as string).trim().length === 0)) return false;
  if (typeof row.value !== 'number' || !Number.isFinite(row.value)) return false;
  if (row.dateGranularity !== undefined
    && (typeof row.dateGranularity !== 'string' || (!granularities.has(row.dateGranularity) && !isValidUnknownState(row.dateGranularity)))) {
    return false;
  }
  return [row.currency, row.timezone, row.attributionWindow, row.occurredAt, row.sourceVersion, row.providerSurface]
    .every((value) => value === undefined || (typeof value === 'string' && (value.trim().length > 0 || isValidUnknownState(value))));
}
