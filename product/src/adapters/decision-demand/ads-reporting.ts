import type { NormalizedAdsMetric } from './ads-metrics-normalizer';

export interface AdsReportRow {
  readonly workspaceId: string;
  readonly provider: NormalizedAdsMetric['provider'];
  readonly accountId: string;
  readonly objectId: string;
  readonly metricName: string;
  readonly value: number;
  readonly currency: string;
  readonly timezone: string;
  readonly occurredAt: string;
  readonly completeness: 'UNKNOWN';
  readonly provenance: 'synthetic-read-only';
  readonly sourceVersions: readonly string[];
}

/** Aggregate already-normalized provider observations without assigning revenue or attribution. */
export function aggregateSyntheticAdsReport(workspaceId: string, metrics: readonly NormalizedAdsMetric[]): readonly AdsReportRow[] {
  const grouped = new Map<string, AdsReportRow & { total: number; versions: Set<string> }>();
  for (const metric of metrics) {
    if (metric.workspaceId !== workspaceId) continue;
    const key = JSON.stringify([metric.provider, metric.providerAccountId, metric.providerObjectId, metric.metricName, metric.currency, metric.timezone, metric.occurredAt]);
    const existing = grouped.get(key);
    if (existing) {
      existing.total += metric.value;
      existing.versions.add(metric.sourceVersion);
      continue;
    }
    grouped.set(key, {
      workspaceId, provider: metric.provider, accountId: metric.providerAccountId, objectId: metric.providerObjectId,
      metricName: metric.metricName, value: metric.value, currency: metric.currency, timezone: metric.timezone,
      occurredAt: metric.occurredAt, completeness: 'UNKNOWN', provenance: 'synthetic-read-only',
      sourceVersions: [metric.sourceVersion], total: metric.value, versions: new Set([metric.sourceVersion]),
    });
  }
  return [...grouped.values()].sort((a, b) => JSON.stringify([a.provider, a.accountId, a.objectId, a.metricName]).localeCompare(JSON.stringify([b.provider, b.accountId, b.objectId, b.metricName]))).map(row => ({
    workspaceId: row.workspaceId, provider: row.provider, accountId: row.accountId, objectId: row.objectId,
    metricName: row.metricName, value: Number(row.total.toFixed(6)), currency: row.currency, timezone: row.timezone,
    occurredAt: row.occurredAt, completeness: row.completeness, provenance: row.provenance,
    sourceVersions: [...row.versions].sort(),
  }));
}
