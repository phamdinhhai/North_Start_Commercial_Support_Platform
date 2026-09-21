import { describe, it, expect } from 'vitest';
import { ManualAdapter } from './manual-adapter';

describe('ManualAdapter (C-05, C-11, R-04/R-05/R-06, I-12)', () => {
  it('creates envelope with required fields', () => {
    const adapter = new ManualAdapter();
    const env = adapter.ingest({
      connection: 'conn-001',
      externalRecordId: 'ext-001',
      externalEventType: 'message',
      rawPayload: { text: 'Hello' },
    });
    expect(env.connection).toBe('conn-001');
    expect(env.externalRecordId).toBe('ext-001');
    expect(env.schemaVersion).toBe(1);
    expect(env.rawPayload).toEqual({ text: 'Hello' });
    expect(env.rawPayloadHash).toHaveLength(64);
    expect(env.mappingStatus).toBe('pending');
  });

  it('idempotent: duplicate ingest returns same envelope (R-06)', () => {
    const adapter = new ManualAdapter();
    const input = {
      connection: 'conn-001',
      externalRecordId: 'ext-dup',
      externalEventType: 'message' as const,
      rawPayload: { text: 'Hi' },
    };
    const a = adapter.ingest(input);
    const b = adapter.ingest({ ...input, rawPayload: { text: 'Changed but same key' } });
    expect(a.envelopeId).toBe(b.envelopeId);
    expect(adapter.count()).toBe(1);
    // raw preserved from first ingest (I-12)
    expect(b.rawPayload).toEqual({ text: 'Hi' });
  });

  it('different externalRecordId creates different envelope', () => {
    const adapter = new ManualAdapter();
    const a = adapter.ingest({ connection: 'c1', externalRecordId: 'e1', externalEventType: 'message', rawPayload: { x: 1 } });
    const b = adapter.ingest({ connection: 'c1', externalRecordId: 'e2', externalEventType: 'message', rawPayload: { x: 1 } });
    expect(a.envelopeId).not.toBe(b.envelopeId);
    expect(adapter.count()).toBe(2);
  });

  it('different connection with same externalRecordId are distinct', () => {
    const adapter = new ManualAdapter();
    const a = adapter.ingest({ connection: 'c1', externalRecordId: 'e1', externalEventType: 'message', rawPayload: { x: 1 } });
    const b = adapter.ingest({ connection: 'c2', externalRecordId: 'e1', externalEventType: 'message', rawPayload: { x: 1 } });
    expect(a.envelopeId).not.toBe(b.envelopeId);
  });

  it('isSynthetic flag propagated (R-28)', () => {
    const adapter = new ManualAdapter();
    const env = adapter.ingest({
      connection: 'c1',
      externalRecordId: 'e1',
      externalEventType: 'message',
      rawPayload: { demo: true },
      isSynthetic: true,
    });
    expect(env.isSynthetic).toBe(true);
  });

  it('throws on missing required fields', () => {
    const adapter = new ManualAdapter();
    expect(() => adapter.ingest({ connection: '', externalRecordId: 'e1', externalEventType: 'message', rawPayload: { x: 1 } })).toThrow('connection is required');
    expect(() => adapter.ingest({ connection: 'c1', externalRecordId: '', externalEventType: 'message', rawPayload: { x: 1 } })).toThrow('externalRecordId is required');
  });

  it('getByKey and getByEnvelopeId work', () => {
    const adapter = new ManualAdapter();
    const env = adapter.ingest({ connection: 'c1', externalRecordId: 'e9', externalEventType: 'message', rawPayload: { ok: true } });
    expect(adapter.getByKey('c1', 'e9')?.envelopeId).toBe(env.envelopeId);
    expect(adapter.getByEnvelopeId(env.envelopeId)?.externalRecordId).toBe('e9');
    expect(adapter.getByKey('c1', 'missing')).toBeUndefined();
  });
});
