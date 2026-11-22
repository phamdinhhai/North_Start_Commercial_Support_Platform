import {describe, expect, it} from 'vitest';
import {hubspotReadBoundary, metaReportingFacts, pancakeReadBoundary} from './provider-fact-quality';

const input = {providerCurrency: 'VND', configuredCurrency: 'VND', configuredTimezone: 'Asia/Ho_Chi_Minh', since: '2026-11-01', until: '2026-11-20'};
describe('provider fact quality', () => {
  it('distinguishes provider currency and configured timezone with units and window', () => {
    expect(metaReportingFacts(input)).toEqual({
      currency: {value: 'VND', source: 'provider-reported'},
      timezone: {value: 'Asia/Ho_Chi_Minh', source: 'caller-supplied'},
      reportingWindow: {since: input.since, until: input.until},
      units: {impressions: 'count', spend: 'currency'},
      revenueInference: 'UNSUPPORTED', attributionInference: 'UNSUPPORTED',
    });
  });
  it('rejects missing, malformed and cross-account currency facts', () => {
    for (const providerCurrency of ['', 'vnd', 'USD']) expect(() => metaReportingFacts({...input, providerCurrency})).toThrow('META_CURRENCY_SCOPE_MISMATCH');
  });
  it('rejects invalid reporting dates and reversed windows', () => {
    for (const since of ['2026-02-30', 'invalid', '2026-12-01']) expect(() => metaReportingFacts({...input, since})).toThrow('META_WINDOW_INVALID');
  });
  it('does not claim provider-confirmed timezone', () => {
    expect(() => metaReportingFacts({...input, configuredTimezone: ''})).toThrow('META_TIMEZONE_INVALID');
    expect(metaReportingFacts(input).timezone.source).toBe('caller-supplied');
  });
  it('keeps Pancake history and historical sends uncertain', () => {
    expect(pancakeReadBoundary).toMatchObject({historyCompleteness: 'UNKNOWN', historicalSendOutcome: 'SEND_UNRESOLVED', outboundEnabled: false, browserMessageProvesApiSend: false});
    expect(Object.isFrozen(pancakeReadBoundary)).toBe(true);
  });
  it('never makes CRM objects canonical Customers or Leads', () => {
    expect(hubspotReadBoundary).toMatchObject({canonicalCustomerIdentity: 'UNKNOWN', canonicalLeadIdentity: 'UNKNOWN', automaticMerge: false, writebackEnabled: false});
  });
});
