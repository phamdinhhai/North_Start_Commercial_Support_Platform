import { describe, expect, it } from 'vitest';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import { normalizeSyntheticAdsMetrics, type RawAdsMetric } from './ads-metrics-normalizer';

const base: RawAdsMetric = {
  workspaceId: 'workspace-a',
  provider: 'google',
  providerAccountId: 'customers/100200300',
  providerObjectId: 'campaigns/998877',
  metricName: 'call_conversions',
  nativeMetric: 'Event.call_info',
  value: 2,
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  dateGranularity: 'day',
  attributionWindow: '30d_click',
  occurredAt: '2026-11-04T00:00:00Z',
  capturedAt: '2026-11-04T01:00:00Z',
  sourceVersion: 'v1.9',
  providerSurface: 'google-data-manager-api',
};

const providerFixtures: readonly RawAdsMetric[] = [
  base,
  {
    ...base,
    provider: 'meta',
    providerAccountId: 'act_445566',
    providerObjectId: 'adset_112233',
    metricName: 'leads',
    nativeMetric: 'actions:offsite_conversion.fb_pixel_lead',
    currency: 'USD',
    timezone: 'UTC',
    dateGranularity: 'hour',
    attributionWindow: '7d_click_1d_view',
    sourceVersion: 'v21.0',
    providerSurface: 'meta-marketing-api',
  },
  {
    ...base,
    provider: 'tiktok',
    providerAccountId: 'adv_778899',
    providerObjectId: 'adgroup_334455',
    metricName: 'conversions',
    nativeMetric: 'complete_payment',
    currency: 'SGD',
    timezone: 'Asia/Singapore',
    dateGranularity: 'lifetime',
    attributionWindow: '7d_click',
    sourceVersion: 'v1.3',
    providerSurface: 'tiktok-business-api',
  },
];

describe('synthetic ads metrics normalizer', () => {
  it.each(providerFixtures)('retains $provider native metric names, granularity, window and source/version provenance', (fixture) => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [fixture]);
    expect(result.diagnostics).toEqual([]);
    expect(result.observations[0]).toMatchObject({
      provider: fixture.provider,
      providerAccountId: fixture.providerAccountId,
      providerObjectId: fixture.providerObjectId,
      metricName: fixture.metricName,
      nativeMetric: fixture.nativeMetric,
      currency: fixture.currency,
      timezone: fixture.timezone,
      dateGranularity: fixture.dateGranularity,
      attributionWindow: fixture.attributionWindow,
      sourceVersion: fixture.sourceVersion,
      providerSurface: fixture.providerSurface,
      unknownFields: [],
      isSynthetic: true,
      provenance: 'synthetic-read-only',
    });
  });

  it('keeps distinct date granularities and attribution windows separate for the same campaign timestamp', () => {
    const hourly = { ...base, dateGranularity: 'hour' as const, value: 1 };
    const daily = { ...base, dateGranularity: 'day' as const, value: 5 };
    const viewWindow = { ...base, attributionWindow: '1d_view', value: 7 };
    const result = normalizeSyntheticAdsMetrics('workspace-a', [hourly, daily, viewWindow]);
    expect(result.diagnostics).toEqual([]);
    expect(result.observations).toHaveLength(3);
  });

  it('preserves UNKNOWN across currency, timezone, dateGranularity, attributionWindow, occurredAt and provenance', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{
      ...base,
      currency: UNKNOWN_SENTINEL,
      timezone: UNKNOWN_SENTINEL,
      dateGranularity: undefined,
      attributionWindow: 'not_observed',
      occurredAt: UNKNOWN_SENTINEL,
      sourceVersion: undefined,
      providerSurface: 'not_requested',
    }]);
    expect(result.observations[0].dateGranularity).toBe(UNKNOWN_SENTINEL);
    expect(result.observations[0].sourceVersion).toBe(UNKNOWN_SENTINEL);
    expect(result.observations[0].unknownFields).toEqual([
      'currency', 'timezone', 'dateGranularity', 'attributionWindow', 'occurredAt', 'sourceVersion', 'providerSurface',
    ]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('rejects nonfinite value %s', (value) => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{ ...base, value }]);
    expect(result.observations).toHaveLength(0);
    expect(result.diagnostics).toContain('MALFORMED_INPUT');
  });

  it('rejects invalid dateGranularity values instead of coercing them', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{ ...base, dateGranularity: 'quarter' as never }]);
    expect(result.observations).toHaveLength(0);
    expect(result.diagnostics).toEqual(['MALFORMED_INPUT']);
  });

  it('reports exact duplicates and conflicting duplicates without overwriting the first observation', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [base, { ...base }, { ...base, value: 9 }, { ...base, currency: 'USD' }]);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].value).toBe(2);
    expect(result.observations[0].currency).toBe('VND');
    expect(result.diagnostics).toEqual(['CONFLICTING_RECORD', 'DUPLICATE_RECORD']);
  });

  it('uses an injective tuple key when IDs or metrics contain colons or slashes', () => {
    const first = { ...base, providerAccountId: 'account:campaign', providerObjectId: 'object', metricName: 'metric' };
    const second = { ...base, providerAccountId: 'account', providerObjectId: 'campaign:object', metricName: 'metric' };
    const result = normalizeSyntheticAdsMetrics('workspace-a', [first, second]);
    expect(result.observations).toHaveLength(2);
    expect(result.diagnostics).toEqual([]);
  });

  it('enforces cross-tenant isolation without leaking foreign workspace observations', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{ ...base, workspaceId: 'workspace:b' }]);
    expect(result.observations).toEqual([]);
    expect(result.diagnostics).toEqual(['CROSS_WORKSPACE_RECORD']);
  });
});
