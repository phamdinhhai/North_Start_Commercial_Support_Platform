import { describe, expect, it } from 'vitest';
import { IntegrationError } from '../../ports/integration';
import { OBSERVATION_UPLOAD_KEYS, validateUpload } from './upload-validation';

const scope = { workspaceId: 'w', connectionId: 'c', accountId: 'a', providerSurface: 'pancake-conversations' as const, pageId: 'p' };
const observation = { scope: { workspaceId: 'w', connectionId: 'c', accountId: 'a', providerSurface: 'pancake-conversations' }, captureId: 'cap-1',
  sourceRevision: 'v1', externalEventId: null, externalObjectId: null, eventType: 'pages:update_messages', method: 'browser-websocket',
  evidenceType: 'client-observed', authenticity: 'UNKNOWN', completeness: 'UNKNOWN', occurredAt: null, observedAt: '2026-11-18T00:00:00Z' };
const body = (patch: Record<string, unknown> = {}) => ({ captureId: 'cap-1', sequence: 1, pageId: 'p', observation: { ...observation, ...patch } });
const status = (value: unknown) => { try { validateUpload(value, scope); return 'accepted'; } catch (error) { return error instanceof IntegrationError ? `${error.status}:${error.code}` : 'other'; } };

describe('ADR-009 upload contract: no content-derived digest from the browser', () => {
  it('accepts filtered metadata without payloadHash', () => {
    expect(status(body())).toBe('accepted');
    expect(Object.keys(validateUpload(body(), scope).observation).sort()).toEqual([...OBSERVATION_UPLOAD_KEYS].sort());
    expect(OBSERVATION_UPLOAD_KEYS).not.toContain('payloadHash');
  });

  it.each([
    ['payloadHash (legacy unkeyed sha256)', { payloadHash: 'a'.repeat(64) }],
    ['payloadHash with any value', { payloadHash: null }],
    ['a keyed digest, which only the server may compute', { payloadDigest: { alg: 'HMAC-SHA256', kid: 'k', value: 'a'.repeat(64) } }],
    ['a body-derived contentHash', { contentHash: 'b'.repeat(64) }],
  ])('rejects an observation carrying %s with 400 INPUT_INVALID', (_name, patch) => {
    expect(status(body(patch))).toBe('400:INPUT_INVALID');
  });
});
