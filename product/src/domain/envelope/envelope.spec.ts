import { describe, it, expect } from 'vitest';
import {
  createEnvelope,
  hashRawPayload,
  idempotencyKey,
  markMapped,
  markMappingError,
  type CommercialEnvelope,
} from './envelope';

describe('CommercialEnvelope v1 (R-05, R-06, I-11, I-12)', () => {
  const base = {
    workspaceId: 'ws-env-test',
    connection: 'conn-ws-001',
    externalRecordId: 'ext-123',
    externalEventType: 'conversation',
    sourceCapturedAt: '2026-09-21T10:00:00Z',
    rawPayload: { sender: 'customer', text: 'Hello' },
  };

  describe('SHA-256 hash', () => {
    it('produces consistent hash for same payload', () => {
      const h1 = hashRawPayload(base.rawPayload);
      const h2 = hashRawPayload(base.rawPayload);
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('produces different hash for different payload', () => {
      const h1 = hashRawPayload({ a: 1 });
      const h2 = hashRawPayload({ a: 2 });
      expect(h1).not.toBe(h2);
    });

    it('hash is stable across object key order at every nesting depth', () => {
      const h1 = hashRawPayload({ outer: { z: 2, a: [{ b: 1, a: null }] }, first: true });
      const h2 = hashRawPayload({ first: true, outer: { a: [{ a: null, b: 1 }], z: 2 } });
      expect(h1).toBe(h2);
    });

    it('preserves arrays, primitives, and null distinctly', () => {
      const values = [null, true, false, 0, 1, '', [], [null], {}, { value: null }];
      expect(new Set(values.map(hashRawPayload)).size).toBe(values.length);
      expect(hashRawPayload([1, 2])).not.toBe(hashRawPayload([2, 1]));
    });

    it('does not collapse nested objects with different values', () => {
      expect(hashRawPayload({ nested: { a: 1 } })).not.toBe(hashRawPayload({ nested: { a: 2 } }));
    });
  });

  describe('createEnvelope', () => {
    it('creates envelope with all required fields', () => {
      const env = createEnvelope(base);
      expect(env.envelopeId).toBeTruthy();
      expect(env.schemaVersion).toBe(1);
      expect(env.connection).toBe('conn-ws-001');
      expect(env.externalRecordId).toBe('ext-123');
      expect(env.mappingStatus).toBe('pending');
      expect(env.acquisitionMode).toBe('imported_record');
      expect(env.acquisitionSource).toBe('manual');
    });

    it('raw payload is a deep clone (I-12 — immutable)', () => {
      const payload = { data: 'test' };
      const env = createEnvelope({ ...base, rawPayload: payload });
      (payload as any).data = 'mutated';
      expect(env.rawPayload).toEqual({ data: 'test' }); // unaffected
    });

    it('hash matches rawPayload', () => {
      const env = createEnvelope(base);
      expect(env.rawPayloadHash).toBe(hashRawPayload(base.rawPayload));
    });

    it('isSynthetic defaults to false', () => {
      const env = createEnvelope(base);
      expect(env.isSynthetic).toBe(false);
    });

    it('isSynthetic settable to true (R-28)', () => {
      const env = createEnvelope({ ...base, isSynthetic: true });
      expect(env.isSynthetic).toBe(true);
    });
  });

  describe('idempotency key (R-06)', () => {
    it('key encodes [workspaceId, connection, externalRecordId] as an injective JSON tuple (R-06 within I-09)', () => {
      const env = createEnvelope(base);
      expect(idempotencyKey(env)).toBe(JSON.stringify(['ws-env-test', 'conn-ws-001', 'ext-123']));
    });

    it('P1-1: colons inside workspaceId or connection never collide across tenants', () => {
      const a = idempotencyKey({ workspaceId: 'review-tenant', connection: 'b:inbox', externalRecordId: 'msg-1' });
      const b = idempotencyKey({ workspaceId: 'review-tenant:b', connection: 'inbox', externalRecordId: 'msg-1' });
      const c = idempotencyKey({ workspaceId: 'review-tenant', connection: 'b', externalRecordId: 'inbox:msg-1' });
      expect(a).not.toBe(b);
      expect(a).not.toBe(c);
      expect(b).not.toBe(c);
    });
  });

  describe('mapping lifecycle', () => {
    it('markMapped sets projection (I-12 preserved)', () => {
      const env = createEnvelope(base);
      const mapped = markMapped(env, { leadId: 'lead-001' });
      expect(mapped.mappingStatus).toBe('mapped');
      expect(mapped.canonicalProjection).toEqual({ leadId: 'lead-001' });
      expect(mapped.rawPayload).toEqual(base.rawPayload); // raw preserved
    });

    it('markMappingError preserves raw (I-12)', () => {
      const env = createEnvelope(base);
      const errEnv = markMappingError(env, 'Missing field: sender');
      expect(errEnv.mappingStatus).toBe('error');
      expect(errEnv.mappingError).toBe('Missing field: sender');
      expect(errEnv.rawPayload).toEqual(base.rawPayload);
    });

    it('markMapped throws on error state', () => {
      const env = createEnvelope(base);
      const errEnv = markMappingError(env, 'fail');
      expect(() => markMapped(errEnv, { ok: true })).toThrow('Cannot mark mapped');
    });
  });
});
