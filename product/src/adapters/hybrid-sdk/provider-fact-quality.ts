/** Read-only fact provenance. These views never project commercial entities. */
export interface MetaReportingFacts {
  readonly currency: {readonly value: string; readonly source: 'provider-reported'};
  readonly timezone: {readonly value: string; readonly source: 'caller-supplied'};
  readonly reportingWindow: {readonly since: string; readonly until: string};
  readonly units: {readonly impressions: 'count'; readonly spend: 'currency'};
  readonly revenueInference: 'UNSUPPORTED';
  readonly attributionInference: 'UNSUPPORTED';
}

/** Provider currency must come from the actual scoped response, not config. */
export function metaReportingFacts(input: {
  providerCurrency: string; configuredCurrency: string; configuredTimezone: string;
  since: string; until: string;
}): MetaReportingFacts {
  if (!/^[A-Z]{3}$/u.test(input.providerCurrency) || input.providerCurrency !== input.configuredCurrency) {
    throw new Error('META_CURRENCY_SCOPE_MISMATCH');
  }
  if (!input.configuredTimezone || input.configuredTimezone.length > 128 || /[\x00-\x1f\x7f]/u.test(input.configuredTimezone)) {
    throw new Error('META_TIMEZONE_INVALID');
  }
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(input.since) || !validDate(input.until) || input.since > input.until) throw new Error('META_WINDOW_INVALID');
  return {
    currency: {value: input.providerCurrency, source: 'provider-reported'},
    timezone: {value: input.configuredTimezone, source: 'caller-supplied'},
    reportingWindow: {since: input.since, until: input.until},
    units: {impressions: 'count', spend: 'currency'},
    revenueInference: 'UNSUPPORTED', attributionInference: 'UNSUPPORTED',
  };
}

export const pancakeReadBoundary = Object.freeze({
  historyCompleteness: 'UNKNOWN', historicalSendOutcome: 'SEND_UNRESOLVED',
  outboundEnabled: false, browserMessageProvesApiSend: false,
} as const);

export const hubspotReadBoundary = Object.freeze({
  sourceEntity: 'CRM_OBJECT', canonicalCustomerIdentity: 'UNKNOWN',
  canonicalLeadIdentity: 'UNKNOWN', automaticMerge: false, writebackEnabled: false,
} as const);
