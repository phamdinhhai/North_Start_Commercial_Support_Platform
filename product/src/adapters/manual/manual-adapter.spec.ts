import { describe, it, expect } from 'vitest';
import { ManualAdapter } from './manual-adapter';

const base = {
  workspaceId: 'ws-test',
  externalEventType: 'message',
} as const;

describe('ManualAdapter (C-05, C-11, R-04/R-05/R-06, I-12)', () => {
  it('creates envelope with required fields', () => {
    const adapter = new ManualAdapter();
    const env = adapter.ingest({
      ...base,
      connection: 'conn-001',
      externalRecordId: 'ext-001',
      rawPayload: { text: 'Hello' },
    });
    expect(env.connection).toBe('conn-001');
    expect(env.externalRecordId).toBe('ext-001');
    expect(env.workspaceId).toBe('ws-test');
    expect(env.schemaVersion).toBe(1);
    expect(env.rawPayload).toEqual({ text: 'Hello' });
    expect(env.rawPayloadHash).toHaveLength(64);
    expect(env.mappingStatus).toBe('pending');
  });

  it('idempotent: duplicate ingest returns same envelope (R-06)', () => {
    const adapter = new ManualAdapter();
    const input = { ...base, connection: 'conn-001', externalRecordId: 'ext-dup' };
    const a = adapter.ingest({ ...input, rawPayload: { text: 'Hi' } });
    const b = adapter.ingest({ ...input, rawPayload: { text: 'Changed but same key' } });
    expect(a.envelopeId).toBe(b.envelopeId);
    expect(adapter.count()).toBe(1);
    // raw preserved from first ingest (I-12)
    expect(b.rawPayload).toEqual({ text: 'Hi' });
  });

  it('different externalRecordId creates different envelope', () => {
    const adapter = new ManualAdapter();
    const a = adapter.ingest({ ...base, connection: 'c1', externalRecordId: 'e1', rawPayload: { x: 1 } });
    const b = adapter.ingest({ ...base, connection: 'c1', externalRecordId: 'e2', rawPayload: { x: 1 } });
    expect(a.envelopeId).not.toBe(b.envelopeId);
    expect(adapter.count()).toBe(2);
  });

  it('different connection with same externalRecordId are distinct', () => {
    const adapter = new ManualAdapter();
    const a = adapter.ingest({ ...base, connection: 'c1', externalRecordId: 'e1', rawPayload: { x: 1 } });
    const b = adapter.ingest({ ...base, connection: 'c2', externalRecordId: 'e1', rawPayload: { x: 1 } });
    expect(a.envelopeId).not.toBe(b.envelopeId);
  });

  it('isSynthetic flag propagated (R-28)', () => {
    const adapter = new ManualAdapter();
    const env = adapter.ingest({
      ...base,
      connection: 'c1',
      externalRecordId: 'e1',
      rawPayload: { demo: true },
      isSynthetic: true,
    });
    expect(env.isSynthetic).toBe(true);
  });

  it('throws on missing required fields', () => {
    const adapter = new ManualAdapter();
    expect(() => adapter.ingest({ ...base, workspaceId: '', connection: 'c1', externalRecordId: 'e1', rawPayload: { x: 1 } })).toThrow(/workspaceId is required/);
    expect(() => adapter.ingest({ ...base, connection: '', externalRecordId: 'e1', rawPayload: { x: 1 } })).toThrow('connection is required');
    expect(() => adapter.ingest({ ...base, connection: 'c1', externalRecordId: '', rawPayload: { x: 1 } })).toThrow('externalRecordId is required');
  });

  it('getByKey and getByEnvelopeId work (workspace-scoped)', () => {
    const adapter = new ManualAdapter();
    const env = adapter.ingest({ ...base, connection: 'c1', externalRecordId: 'e9', rawPayload: { ok: true } });
    expect(adapter.getByKey('ws-test', 'c1', 'e9')?.envelopeId).toBe(env.envelopeId);
    expect(adapter.getByEnvelopeId(env.envelopeId)?.externalRecordId).toBe('e9');
    expect(adapter.getByKey('ws-test', 'c1', 'missing')).toBeUndefined();
  });

  // P1-1 regression: an idempotency key that omits workspace lets one workspace
  // receive ANOTHER workspace's raw evidence (R-06 scope, I-09/R-01 isolation).
  describe('P1-1: idempotency key must be workspace-scoped (R-06 within I-09)', () => {
    it('same connection+externalRecordId from DIFFERENT workspaces → distinct envelopes, no cross-workspace reuse', () => {
      const adapter = new ManualAdapter();
      const a = adapter.ingest({ workspaceId: 'ws-a', connection: 'pancake-page-1', externalRecordId: 'msg-001', externalEventType: 'message', rawPayload: { text: 'A evidence' } });
      const b = adapter.ingest({ workspaceId: 'ws-b', connection: 'pancake-page-1', externalRecordId: 'msg-001', externalEventType: 'message', rawPayload: { text: 'B evidence' } });

      expect(a.envelopeId).not.toBe(b.envelopeId);
      expect(b.rawPayload).toEqual({ text: 'B evidence' }); // NOT A's payload
      expect(adapter.count()).toBe(2);
    });

    it('same workspace+connection+externalRecordId → idempotent (unchanged R-06)', () => {
      const adapter = new ManualAdapter();
      const a = adapter.ingest({ workspaceId: 'ws-a', connection: 'c1', externalRecordId: 'e1', externalEventType: 'message', rawPayload: { x: 1 } });
      const b = adapter.ingest({ workspaceId: 'ws-a', connection: 'c1', externalRecordId: 'e1', externalEventType: 'message', rawPayload: { x: 2 } });
      expect(a.envelopeId).toBe(b.envelopeId);
      expect(b.rawPayload).toEqual({ x: 1 });
    });

    it('rejects ingest without workspaceId — no silent unscoped envelope', () => {
      const adapter = new ManualAdapter();
      expect(() =>
        adapter.ingest({ connection: 'c1', externalRecordId: 'e1', externalEventType: 'message', rawPayload: { x: 1 } } as never),
      ).toThrow(/workspaceId is required/);
    });

    it('envelope carries workspaceId (provenance of scope) and lookups are scoped', () => {
      const adapter = new ManualAdapter();
      const env = adapter.ingest({ workspaceId: 'ws-a', connection: 'c1', externalRecordId: 'e1', externalEventType: 'message', rawPayload: { x: 1 } });
      expect(env.workspaceId).toBe('ws-a');
      expect(adapter.getByKey('ws-a', 'c1', 'e1')?.envelopeId).toBe(env.envelopeId);
      expect(adapter.getByKey('ws-b', 'c1', 'e1')).toBeUndefined();
    });

    it('colons in workspaceId or connection do not collide across tenants (P1-1 delimiter collision)', () => {
      const adapter = new ManualAdapter();
      const a = adapter.ingest({
        workspaceId: 'review-tenant',
        connection: 'b:inbox',
        externalRecordId: 'msg-1',
        externalEventType: 'message',
        rawPayload: { tenant: 'A' },
      });
      const b = adapter.ingest({
        workspaceId: 'review-tenant:b',
        connection: 'inbox',
        externalRecordId: 'msg-1',
        externalEventType: 'message',
        rawPayload: { tenant: 'B' },
      });
      expect(a.envelopeId).not.toBe(b.envelopeId);
      expect(b.rawPayload).toEqual({ tenant: 'B' });
      expect(adapter.count()).toBe(2);
    });
  });
});
