import { classifyProviderError, object, observation, text, timestamp, type ProviderContext, type ReadOnlyObservation, type ReadOnlyProviderAdapter } from './provider-adapter';

export class TikTokReadAdapter implements ReadOnlyProviderAdapter {
  readonly provider = 'tiktok-business' as const;
  recognize(input: unknown): ProviderContext {
    const value = object(input);
    if (value.provider !== this.provider || value.surface !== 'ad-account') throw new Error('TIKTOK_CONTEXT_MISMATCH');
    return { provider: this.provider, accountId: text(value.accountId, 'account_id'), pageId: null, nativeObjectId: text(value.advertiserId, 'advertiser_id'), surface: 'ad-account', observedAt: timestamp(value.observedAt) };
  }
  observe(input: unknown): ReadOnlyObservation {
    const value = object(input), context = this.recognize(value.context);
    if (value.kind !== 'ads.report') throw new Error('TIKTOK_SCHEMA_DRIFT');
    const fields = object(value.fields);
    if (!Array.isArray(fields.rows) || fields.rows.length > 1000) throw new Error('TIKTOK_SCHEMA_DRIFT');
    return observation(this, context, 'ads.report', fields);
  }
  classifyError(input: unknown) { return classifyProviderError(input); }
}
