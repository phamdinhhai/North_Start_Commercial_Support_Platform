import { describe, expect, it } from 'vitest';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import { normalizeSyntheticAdsMetrics, type RawAdsMetric } from './ads-metrics-normalizer';

const base: RawAdsMetric = {
  workspaceId: 'workspace-a', provider: 'google', providerAccountId: 'ads-1', providerObjectId: 'campaign-1',
  metricName: 'conversions', value: 2, currency: 'USD', timezone: 'UTC', attributionWindow: '7d_click',
  occurredAt: '2026-11-04T00:00:00Z', capturedAt: '2026-11-04T01:00:00Z', nativeMetric: 'conversions',
};

describe('synthetic ads metrics normalizer', () => {
  it('preserves provider identity, native metric, currency and attribution metadata', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [base]);
    expect(result.diagnostics).toEqual([]);
    expect(result.observations[0]).toMatchObject({ provider: 'google', providerObjectId: 'campaign-1', nativeMetric: 'conversions', currency: 'USD', attributionWindow: '7d_click', isSynthetic: true });
  });
  it('preserves UNKNOWN rather than fabricating missing dimensions', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{ ...base, currency: UNKNOWN_SENTINEL, timezone: UNKNOWN_SENTINEL, occurredAt: UNKNOWN_SENTINEL }]);
    expect(result.observations[0].unknownFields).toEqual(['currency', 'timezone', 'occurredAt']);
    expect(result.observations[0].currency).toBe(UNKNOWN_SENTINEL);
  });
  it('diagnoses malformed input', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{ ...base, value: Number.NaN }]);
    expect(result.observations).toHaveLength(0);
    expect(result.diagnostics).toContain('MALFORMED_INPUT');
  });
  it('diagnoses exact duplicates and conflicting duplicates', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [base, base, { ...base, value: 3 }]);
    expect(result.observations).toHaveLength(1);
    expect(result.diagnostics).toEqual(['CONFLICTING_RECORD', 'DUPLICATE_RECORD']);
  });
  it('rejects cross-workspace records without leaking them into output', () => {
    const result = normalizeSyntheticAdsMetrics('workspace-a', [{ ...base, workspaceId: 'workspace-b' }]);
    expect(result.observations).toEqual([]);
    expect(result.diagnostics).toEqual(['CROSS_WORKSPACE_RECORD']);
  });
});
