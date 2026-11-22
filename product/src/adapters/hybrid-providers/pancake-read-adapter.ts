import { classifyProviderError, object, observation, text, timestamp, type ProviderContext, type ReadOnlyObservation, type ReadOnlyProviderAdapter } from './provider-adapter';

export class PancakeReadAdapter implements ReadOnlyProviderAdapter {
  readonly provider = 'pancake' as const;
  recognize(input: unknown): ProviderContext {
    const value = object(input);
    if (value.provider !== 'pancake' || value.surface !== 'conversation') throw new Error('PANCAKE_CONTEXT_MISMATCH');
    return { provider: 'pancake', accountId: text(value.accountId, 'account_id'), pageId: text(value.pageId, 'page_id'), nativeObjectId: text(value.conversationId, 'conversation_id'), surface: 'conversation', observedAt: timestamp(value.observedAt) };
  }
  observe(input: unknown): ReadOnlyObservation {
    const value = object(input), context = this.recognize(value.context);
    if (value.kind !== 'conversation.history') throw new Error('PANCAKE_SCHEMA_DRIFT');
    const fields = object(value.fields);
    if (!Array.isArray(fields.messages) || fields.messages.length > 100) throw new Error('PANCAKE_SCHEMA_DRIFT');
    return observation(this, context, 'conversation.history', fields);
  }
  classifyError(input: unknown) { return classifyProviderError(input); }
}
