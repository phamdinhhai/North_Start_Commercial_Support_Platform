import { describe, expect, it } from 'vitest';
import { aggregateSyntheticAdsReport } from './ads-reporting';
import type { NormalizedAdsMetric } from './ads-metrics-normalizer';

const metric = (patch: Partial<NormalizedAdsMetric> = {}): NormalizedAdsMetric => ({
  workspaceId: 'w', provider: 'meta', providerAccountId: 'act_1', providerObjectId: 'campaign_1', metricName: 'spend', value: 2.5,
  currency: 'USD', timezone: 'UTC', dateGranularity: 'day', attributionWindow: 'UNKNOWN', occurredAt: '2026-11-01', capturedAt: '2026-11-01T00:00:00Z', nativeMetric: 'spend', sourceVersion: 'fixture-v1', providerSurface: 'meta-ads', isSynthetic: true, sourceSystem: 'meta', unknownFields: ['attributionWindow'], provenance: 'synthetic-read-only', ...patch,
});

describe('native synthetic Ads reporting', () => {
  it('aggregates same scoped metric and preserves units/provenance', () => {
    const [row] = aggregateSyntheticAdsReport('w', [metric(), metric({ value: 1.25, sourceVersion: 'fixture-v2' })]);
    expect(row).toMatchObject({ value: 3.75, currency: 'USD', timezone: 'UTC', completeness: 'UNKNOWN', provenance: 'synthetic-read-only' });
    expect(row.sourceVersions).toEqual(['fixture-v1', 'fixture-v2']);
  });
  it('denies foreign workspace rows without leaking them into results', () => {
    expect(aggregateSyntheticAdsReport('w', [metric({ workspaceId: 'foreign' })])).toEqual([]);
  });
  it('does not promote non-synthetic observations into the fixture report', () => {
    expect(aggregateSyntheticAdsReport('w', [metric({ isSynthetic: false })])).toEqual([]);
  });
  it('keeps distinct currency/timezone slices separate', () => {
    const rows = aggregateSyntheticAdsReport('w', [metric(), metric({ currency: 'EUR' }), metric({ timezone: 'Asia/Ho_Chi_Minh' })]);
    expect(rows).toHaveLength(3);
  });
});
