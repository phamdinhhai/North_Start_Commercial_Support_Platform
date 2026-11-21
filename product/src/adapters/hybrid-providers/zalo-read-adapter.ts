import { classifyProviderError, object, observation, text, timestamp, type ProviderContext, type ReadOnlyObservation, type ReadOnlyProviderAdapter } from './provider-adapter';

export class ZaloReadAdapter implements ReadOnlyProviderAdapter {
  readonly provider = 'zalo-oa' as const;
  recognize(input: unknown): ProviderContext {
    const value = object(input);
    if (value.provider !== this.provider || value.surface !== 'oa-inbox') throw new Error('ZALO_CONTEXT_MISMATCH');
    return { provider: this.provider, accountId: text(value.accountId, 'account_id'), pageId: text(value.oaId, 'oa_id'), nativeObjectId: text(value.threadId, 'thread_id'), surface: 'oa-inbox', observedAt: timestamp(value.observedAt) };
  }
  observe(input: unknown): ReadOnlyObservation {
    const value = object(input), context = this.recognize(value.context);
    if (value.kind !== 'oa.thread') throw new Error('ZALO_SCHEMA_DRIFT');
    const fields = object(value.fields);
    if (!Array.isArray(fields.messages) || fields.messages.length > 100) throw new Error('ZALO_SCHEMA_DRIFT');
    return observation(this, context, 'oa.thread', fields);
  }
  classifyError(input: unknown) { return classifyProviderError(input); }
}
