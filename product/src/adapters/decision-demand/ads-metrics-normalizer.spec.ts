import { describe, expect, it } from 'vitest';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import { normalizeSyntheticAdsMetrics, type RawAdsMetric } from './ads-metrics-normalizer';

const base: RawAdsMetric = {
  workspaceId: 'workspace-a', provider: 'google', providerAccountId: 'ads-1', providerObjectId: 'campaign-1',
  metricName: 'conversions', value: 2, currency: 'USD', timezone: 'UTC', dateGranularity: 'day',
  attributionWindow: '7d_click', occurredAt: '2026-11-04T00:00:00Z', capturedAt: '2026-11-04T01:00:00Z',
  nativeMetric: 'conversions', sourceVersion: 'v18',
};

const providerFixtures: readonly RawAdsMetric[] = (['google', 'meta', 'tiktok'] as const).map((provider, index) => ({
  ...base, provider, providerAccountId: `${provider}-account`, providerObjectId: `${provider}-campaign-${index}`,
}));

describe('synthetic ads metrics normalizer', () => {
  it.each(providerFixtures)('retains $provider identity and provenance', (fixture) => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [fixture]);
    expect(result.diagnostics).toEqual([]);
    expect(result.observations[0]).toMatchObject({
      provider: fixture.provider, providerAccountId: fixture.providerAccountId, providerObjectId: fixture.providerObjectId,
      nativeMetric: 'conversions', currency: 'USD', timezone: 'UTC', dateGranularity: 'day',
      attributionWindow: '7d_click', sourceVersion: 'v18', isSynthetic: true, provenance: 'synthetic-read-only',
    });
  });

  it('preserves UNKNOWN for currency, timezone, granularity, attribution and source version', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{
      ...base, currency: UNKNOWN_SENTINEL, timezone: UNKNOWN_SENTINEL, dateGranularity: UNKNOWN_SENTINEL,
      attributionWindow: UNKNOWN_SENTINEL, occurredAt: UNKNOWN_SENTINEL, sourceVersion: UNKNOWN_SENTINEL,
    }]);
    expect(result.observations[0].unknownFields).toEqual([
      'currency', 'timezone', 'dateGranularity', 'attributionWindow', 'occurredAt', 'sourceVersion',
    ]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('rejects nonfinite value %s', (value) => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{ ...base, value }]);
    expect(result.observations).toHaveLength(0);
    expect(result.diagnostics).toContain('MALFORMED_INPUT');
  });

  it('reports exact duplicates and conflicting duplicates without overwriting the first observation', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [base, base, { ...base, value: 3 }]);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].value).toBe(2);
    expect(result.diagnostics).toEqual(['CONFLICTING_RECORD', 'DUPLICATE_RECORD']);
  });

  it('uses an injective tuple key when IDs contain delimiters', () => {
    const first = { ...base, providerAccountId: 'account:campaign', providerObjectId: 'object', metricName: 'metric' };
    const second = { ...base, providerAccountId: 'account', providerObjectId: 'campaign:object', metricName: 'metric' };
    const result = normalizeSyntheticAdsMetrics('workspace-a', [first, second]);
    expect(result.observations).toHaveLength(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('rejects cross-workspace records without leaking them into output', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{ ...base, workspaceId: 'workspace:b' }]);
    expect(result.observations).toEqual([]);
    expect(result.diagnostics).toEqual(['CROSS_WORKSPACE_RECORD']);
  });
});
