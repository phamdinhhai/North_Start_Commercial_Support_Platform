import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
const moduleUrl = pathToFileURL(resolve('src/adapters/browser-companion/upload.mjs')).href;
const scope = { workspaceId: 'w', connectionId: 'c', accountId: 'a', pageId: 'p', providerSurface: 'pancake-conversations' };
const enrollment = { enrollmentId: 'enrollment', token: 'x'.repeat(64), expiresAt: '2099-01-01T00:00:00Z', scope };
const record = { captureId: 'capture', scope: { workspaceId: 'w', connectionId: 'c', accountId: 'a', providerSurface: 'pancake-conversations' } };
async function fixture() {
  const api = await import(moduleUrl);
  const state = api.configureUpload({ outbox: [], session: null }, { origin: 'https://backend.example', enrollment });
  state.outbox.push(record);
  return { api, state: api.reserveUpload(state) };
}
const ack = { receiptId: 'receipt', disposition: 'stored', checkpoint: 1, continuity: 'UNKNOWN', enrollmentId: 'enrollment', captureId: 'capture', sequence: 1 };
describe('durable enrolled upload protocol', () => {
  it('reuses persisted requests after offline suspension and lost ACK then accepts duplicates', async () => {
    const { api, state } = await fixture();
    const restarted = api.reserveUpload(structuredClone(state));
    expect(restarted.upload.pending).toEqual(state.upload.pending);
    const retry = api.applyUploadResponse(restarted, 503, null);
    expect(api.reserveUpload(retry).upload.pending).toEqual(state.upload.pending);
    const delivered = api.applyUploadResponse(retry, 200, { ...ack, disposition: 'duplicate' });
    expect(delivered.outbox).toEqual([]);
    expect(delivered.upload.nextSequence).toBe(2);
  });
  it('retains evidence for unbound, malformed and conflicting ACKs', async () => {
    const { api, state } = await fixture();
    for (const patch of [{ enrollmentId: 'foreign' }, { captureId: 'foreign' }, { sequence: 2 }, { checkpoint: 0 }, { checkpoint: 9 }, { continuity: 'COMPLETE' }, { receiptId: '' }, { disposition: 'accepted' }]) expect(api.applyUploadResponse(state, 200, { ...ack, ...patch }).outbox).toEqual(state.outbox);
    expect(api.applyUploadResponse(state, 409, null).upload.status).toBe('blocked');
    expect(() => api.reserveUpload(api.applyUploadResponse(state, 409, null))).toThrow('enrollment_required');
  });
  it('accepts an exact duplicate ACK after the server checkpoint advances', async () => {
    const { api, state } = await fixture();
    const delivered = api.applyUploadResponse(state, 200, { ...ack, disposition: 'duplicate', checkpoint: 2 });
    expect(delivered.outbox).toEqual([]);
    expect(delivered.upload.nextSequence).toBe(3);
    expect(delivered.upload.checkpoint).toBe(2);
  });
  it('removes local authority on 401/403 while preserving evidence and redacts exports', async () => {
    const { api, state } = await fixture();
    for (const status of [401, 403]) {
      const denied = api.applyUploadResponse(state, status, null);
      expect(denied.upload.token).toBeNull();
      expect(denied.outbox).toEqual(state.outbox);
      expect(() => api.reserveUpload(denied)).toThrow('enrollment_required');
    }
    expect(JSON.stringify(api.exportMetadata(state))).not.toContain(enrollment.token);
  });
  it('rejects scope drift, evidence relabeling, insecure origins and excessive bodies', async () => {
    const { api, state } = await fixture();
    expect(api.captureMatchesEnrollment({ ...scope, pageId: 'other' }, state.upload)).toBe(false);
    expect(() => api.configureUpload(state, { origin: 'https://backend.example', enrollment: { ...enrollment, enrollmentId: 'new' } })).toThrow('pending_outbox_binding');
    expect(() => api.reserveUpload({ ...state, outbox: [{ ...record, scope: { ...record.scope, accountId: 'other' } }] })).toThrow('observation_scope_mismatch');
    for (const origin of ['http://backend.example', 'https://user:pass@backend.example', 'https://backend.example/path']) expect(() => api.backendOrigin(origin)).toThrow();
    expect(() => api.reserveUpload({ ...state, upload: { ...state.upload, pending: null }, outbox: [{ ...record, padding: 'x'.repeat(16384) }] })).toThrow('upload_size_limit');
  });
});
