import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { configuredContentDigester } from './configured-content-digester';
import { createHmacContentDigester, InMemoryWorkspaceKeyring } from '../../ports/content-digester';
import { installContentDigester } from '../../ports/content-digester-runtime';
import { createEnvelope, hashRawPayload } from '../../domain/envelope/envelope';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { argumentsIntact, freezeArguments } from '../../domain/governed-action/canonical-json';
import { previewDigestOf } from '../../domain/governed-action/action-lifecycle';
import { decodeDigest } from '../../ports/versioned-content-digest';

const input = { workspaceId: 'ws', connection: 'manual', externalRecordId: '1', externalEventType: 'message', sourceCapturedAt: '2026-11-19T00:00:00Z', rawPayload: { utterance: 'ok' } };

describe('R4 server-held digest configuration', () => {
  it('fails closed in production/pilot and never prints secrets on malformed config', () => {
    for (const env of [{ NODE_ENV: 'production' }, { DEPLOYMENT_MODE: 'production', NODE_ENV: 'test' }, { DEPLOYMENT_MODE: 'pilot', NODE_ENV: 'test' }, { NODE_ENV: 'pilot', CONTENT_DIGEST_EPHEMERAL: 'true' }, {}]) {
      expect(() => configuredContentDigester(env)).toThrow('content_digest_keys_required');
    }
    expect(() => configuredContentDigester({ CONTENT_DIGEST_KEYS_JSON: 'secret-not-json' })).toThrow('invalid_content_digest_key_configuration');
  });
  it('requires explicit development opt-in, while test keys stay stable within a process instance', () => {
    expect(() => configuredContentDigester({ NODE_ENV: 'development' })).toThrow();
    const d = configuredContentDigester({ NODE_ENV: 'development', CONTENT_DIGEST_EPHEMERAL: 'true' });
    expect(d.digest('a', 'message', 'ok')).toEqual(d.digest('a', 'message', 'ok'));
    expect(d.digest('a', 'message', 'ok').value).not.toEqual(d.digest('b', 'message', 'ok').value);
  });
  it('loads active + retired keys and refuses missing active, duplicate tenant and short keys', () => {
    const entry = { workspaceId: 'ws', activeKid: 'new', keys: [{ kid: 'old', secretBase64: randomBytes(32).toString('base64') }, { kid: 'new', secretBase64: randomBytes(32).toString('base64') }] };
    const env = (rows: unknown) => ({ CONTENT_DIGEST_KEYS_JSON: JSON.stringify(rows) });
    const d = configuredContentDigester(env([entry]));
    expect(d.digest('ws', 'message', 'ok').kid).toBe('new');
    expect(() => d.digest('foreign', 'message', 'ok')).toThrow('digest_key_unavailable');
    for (const rows of [[{ ...entry, activeKid: 'absent' }], [entry, entry], [{ ...entry, keys: [{ kid: 'new', secretBase64: 'YQ==' }] }]]) expect(() => configuredContentDigester(env(rows))).toThrow('invalid_content_digest_key_configuration');
  });
});

describe('R4 customer-content digests and immutable compatibility', () => {
  it('keys all new envelopes by workspace; retries after rotation preserve original evidence bytes', () => {
    const ring = new InMemoryWorkspaceKeyring(); ring.rotate('ws', 'old', randomBytes(32)); ring.rotate('other', 'old', randomBytes(32));
    installContentDigester(createHmacContentDigester(ring));
    const adapter = new ManualAdapter(); const old = adapter.ingest(input);
    expect(old.rawPayloadHash).not.toBe(hashRawPayload(input.rawPayload));
    expect(old.rawPayloadDigest?.algorithm_version).toBe('hmac-sha256-v1');
    expect(createEnvelope({ ...input, workspaceId: 'other' }).rawPayloadHash).not.toBe(old.rawPayloadHash);
    ring.rotate('ws', 'new', randomBytes(32));
    expect(adapter.ingest(input)).toBe(old);
    expect(createEnvelope(input).rawPayloadDigest?.kid).toBe('new');
    expect(() => adapter.ingest({ ...input, rawPayload: { utterance: 'changed' } })).toThrow('different immutable fields');
  });
  it('retains legacy argument verification and verifies keyed arguments/preview with their own retired kid', () => {
    const ring = new InMemoryWorkspaceKeyring(); ring.rotate('ws', 'old', randomBytes(32));
    installContentDigester(createHmacContentDigester(ring));
    const frozen = freezeArguments({ phone: '0123' }, 'ws');
    const argument = { workspaceId: 'ws', arguments: frozen.arguments, canonicalArguments: frozen.canonical, argumentDigest: frozen.digest };
    const before = { status: 'UNKNOWN' as const, reason: 'fixture' };
    const preview = previewDigestOf(frozen.digest, before, [], undefined, 'ws');
    ring.rotate('ws', 'new', randomBytes(32));
    expect(argumentsIntact(argument)).toBe(true);
    expect(argumentsIntact({ ...argument, workspaceId: 'other' })).toBe(false);
    expect(previewDigestOf(frozen.digest, before, [], undefined, 'ws', preview)).toBe(preview);
    expect(() => previewDigestOf(frozen.digest, before, [{ path: 'x', before: null, after: 'changed', beforeKnown: false }], undefined, 'ws', preview)).toThrow('preview digest mismatch');
    const legacy = freezeArguments({ phone: '0123' });
    expect(argumentsIntact({ arguments: legacy.arguments, canonicalArguments: legacy.canonical, argumentDigest: legacy.digest })).toBe(true);
    expect(decodeDigest(frozen.digest)?.kid).toBe('old');
    expect(decodeDigest('hmac-sha256-v1:bad:kid:' + 'a'.repeat(64))).toBeUndefined();
  });
});
