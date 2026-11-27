import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compareDigests, createHmacContentDigester, InMemoryWorkspaceKeyring, validContentDigest } from './content-digester';
import { RuntimeTestKeyring, testDigester } from './digest-test-support';
import { observePhoenixFrame, type CaptureContext } from './phoenix-observer';
import { classifyLifecycleFrame } from './message-lifecycle';
import { emptyLedger, recordSighting } from './message-ledger';
import { advanceContinuity, initialContinuity } from './continuity';
import { OBSERVATION_METADATA_KEYS, observationMetadata } from './observation';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const scopeOf = (workspaceId: string) => ({ workspaceId, connectionId: 'c-1', accountId: 'a-1', providerSurface: 'pancake-conversations' as const });
const contextFor = (workspaceId: string, digester = testDigester()): CaptureContext => ({
  scope: scopeOf(workspaceId), allowedPageIds: ['p-1'], captureId: 'cap-1', sourceRevision: 'adr009-v1',
  observedAt: '2026-11-18T00:00:00.000Z', direction: 'received', digester,
});
const shortBody = JSON.stringify([null, null, 'pages:p-1', 'pages:update_messages', { conversation_id: 'conv-1', messages: [{ id: 'm-1', message: 'ok' }] }]);

describe('ADR-009 ContentDigester (HMAC-SHA256, per-workspace key with kid)', () => {
  it('gives different digests for the same content in two workspaces and never equals the unkeyed sha256', () => {
    const digester = testDigester();
    const a = digester.digest('ws-a', 'message', '0901234567');
    const b = digester.digest('ws-b', 'message', '0901234567');
    expect(validContentDigest(a) && validContentDigest(b)).toBe(true);
    expect(a.value).not.toBe(b.value);
    expect(compareDigests(a, b)).toBe('incomparable');
    expect([a.value, b.value]).not.toContain(sha256('0901234567'));
  });

  it('separates workspaces even if a key were mis-shared between them', () => {
    const keyring = new InMemoryWorkspaceKeyring();
    const shared = randomBytes(32);
    keyring.rotate('ws-a', 'shared', shared);
    keyring.rotate('ws-b', 'shared', shared);
    const digester = createHmacContentDigester(keyring);
    expect(compareDigests(digester.digest('ws-a', 'frame', 'ok'), digester.digest('ws-b', 'frame', 'ok'))).toBe('different');
  });

  it('is stable for the same workspace + key and separates purposes', () => {
    const digester = testDigester();
    expect(digester.digest('ws-a', 'frame', 'ok')).toEqual(digester.digest('ws-a', 'frame', Buffer.from('ok')));
    expect(compareDigests(digester.digest('ws-a', 'frame', 'ok'), digester.digest('ws-a', 'message', 'ok'))).toBe('different');
  });

  it('rotation issues a new kid; old digests stay verifiable only under the old kid', () => {
    const keyring = new InMemoryWorkspaceKeyring();
    keyring.rotate('ws-a', 'ws-a.2026-11', randomBytes(32));
    const digester = createHmacContentDigester(keyring);
    const before = digester.digest('ws-a', 'message', 'ok');
    keyring.rotate('ws-a', 'ws-a.2026-12', randomBytes(32));
    const after = digester.digest('ws-a', 'message', 'ok');
    expect(after.kid).toBe('ws-a.2026-12');
    expect(after.value).not.toBe(before.value);
    expect(compareDigests(before, after)).toBe('incomparable');
    expect(digester.matches('ws-a', 'message', 'ok', before)).toBe(true);
    expect(digester.matches('ws-a', 'message', 'not-ok', before)).toBe(false);
    expect(digester.matches('ws-b', 'message', 'ok', before)).toBe('UNKNOWN');
    expect(() => keyring.rotate('ws-a', 'ws-a.2026-11', randomBytes(32))).toThrow('digest_kid_reused');
  });

  it('refuses short keys, malformed kids, missing keys and malformed digests', () => {
    const keyring = new InMemoryWorkspaceKeyring();
    expect(() => keyring.rotate('ws-a', 'k1', randomBytes(16))).toThrow('invalid_digest_key');
    expect(() => keyring.rotate('ws-a', 'bad kid', randomBytes(32))).toThrow('invalid_digest_key');
    const digester = createHmacContentDigester(keyring);
    expect(() => digester.digest('ws-a', 'frame', 'x')).toThrow('digest_key_unavailable');
    expect(() => digester.digest('', 'frame', 'x')).toThrow('invalid_workspace');
    expect(() => digester.digest('ws-a', 'other' as never, 'x')).toThrow('invalid_digest_purpose');
    expect(() => compareDigests({ alg: 'HMAC-SHA256', kid: 'k', value: 'abc' }, { alg: 'HMAC-SHA256', kid: 'k', value: 'abc' })).toThrow('invalid_content_digest');
    expect(validContentDigest({ alg: 'HMAC-SHA256', kid: 'k', value: 'a'.repeat(64), extra: 1 })).toBe(false);
    expect(() => createHmacContentDigester({} as never)).toThrow('invalid_keyring');
  });
});

describe('ADR-009 adaptive-connectivity emits keyed digests only', () => {
  it('observation carries payloadDigest {alg,kid,value}; no unkeyed payloadHash and no sha256 of the frame', () => {
    const result = observePhoenixFrame(shortBody, contextFor('ws-a'));
    if (result.kind !== 'observation') throw new Error('expected observation');
    expect(result.observation).not.toHaveProperty('payloadHash');
    expect(validContentDigest(result.observation.payloadDigest)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(sha256(shortBody));
    expect(Object.keys(observationMetadata(result.observation)).sort()).toEqual([...OBSERVATION_METADATA_KEYS].sort());
    expect(OBSERVATION_METADATA_KEYS).not.toContain('payloadHash');
  });

  it('the same frame observed in two workspaces is unlinkable; same workspace + key is stable', () => {
    const digester = testDigester();
    const observe = (workspaceId: string) => {
      const result = observePhoenixFrame(shortBody, contextFor(workspaceId, digester));
      if (result.kind !== 'observation') throw new Error('expected observation');
      return result.observation.payloadDigest;
    };
    expect(observe('ws-a').value).not.toBe(observe('ws-b').value);
    expect(observe('ws-a')).toEqual(observe('ws-a'));
  });

  it('message contentDigest, read-state and quarantined drift digests are keyed with a kid', () => {
    const digester = testDigester();
    const message = classifyLifecycleFrame(shortBody, contextFor('ws-a', digester));
    if (message.kind !== 'message-metadata') throw new Error('expected metadata');
    const [meta] = message.messages;
    expect(meta).not.toHaveProperty('contentHash');
    expect(validContentDigest(meta.contentDigest)).toBe(true);
    expect(meta.contentDigest.value).not.toBe(sha256(JSON.stringify({ id: 'm-1', message: 'ok' })));
    const other = classifyLifecycleFrame(shortBody, contextFor('ws-b', digester));
    if (other.kind !== 'message-metadata') throw new Error('expected metadata');
    expect(compareDigests(meta.contentDigest, other.messages[0].contentDigest)).toBe('incomparable');
    const driftRaw = JSON.stringify([null, null, 'pages:p-1', 'pages:new_feature', { body: 'ok' }]);
    const drift = classifyLifecycleFrame(driftRaw, contextFor('ws-a', digester));
    if (drift.kind !== 'schema-drift') throw new Error('expected drift');
    expect(drift.drift).not.toHaveProperty('payloadHash');
    expect(validContentDigest(drift.drift.payloadDigest)).toBe(true);
    expect(JSON.stringify(drift)).not.toContain(sha256(driftRaw));
    const seen = classifyLifecycleFrame(JSON.stringify([null, null, 'pages:p-1', 'pages:seen_conversation', { conversation_id: 'conv-1', seen: true }]), contextFor('ws-a', digester));
    if (seen.kind !== 'read-state') throw new Error('expected read-state');
    expect(validContentDigest(seen.observation.payloadDigest)).toBe(true);
  });

  it('the ledger never calls a digest under a different kid "changed" or "same"', () => {
    const keyring = new RuntimeTestKeyring();
    const digester = testDigester(keyring);
    const sighting = (captureId: string, second: number) => {
      const result = classifyLifecycleFrame(shortBody, { ...contextFor('ws-a', digester), captureId, observedAt: `2026-11-18T00:00:0${second}.000Z` });
      if (result.kind !== 'message-metadata') throw new Error('expected metadata');
      return { captureId, observedAt: result.observation.observedAt, label: result.label, message: result.messages[0] };
    };
    const first = recordSighting(emptyLedger(), sighting('cap-1', 1));
    expect(recordSighting(first.state, sighting('cap-2', 2)).disposition).toBe('re-observed-same');
    keyring.rotate('ws-a', 'ws-a.k2', randomBytes(32));
    expect(recordSighting(first.state, sighting('cap-3', 3)).disposition).toBe('re-observed-incomparable');
    expect(() => recordSighting(emptyLedger(), { ...sighting('cap-4', 4), message: { ...sighting('cap-4', 4).message, contentDigest: { alg: 'HMAC-SHA256', kid: 'k', value: 'abc' } } })).toThrow('invalid_sighting');
  });

  it('continuity fingerprints bind the digest kid, so a replay after rotation surfaces as conflict, not duplicate', () => {
    const keyring = new RuntimeTestKeyring();
    const digester = testDigester(keyring);
    const observe = () => {
      const result = observePhoenixFrame(shortBody, contextFor('ws-a', digester));
      if (result.kind !== 'observation') throw new Error('expected observation');
      return result.observation;
    };
    const connected = advanceContinuity(initialContinuity(scopeOf('ws-a')), { kind: 'connected', at: '2026-11-18T00:00:00.000Z' }).state;
    const accepted = advanceContinuity(connected, { kind: 'observation', observation: observe() });
    expect(advanceContinuity(accepted.state, { kind: 'observation', observation: observe() }).disposition).toBe('duplicate');
    keyring.rotate('ws-a', 'ws-a.k2', randomBytes(32));
    expect(advanceContinuity(accepted.state, { kind: 'observation', observation: observe() }).disposition).toBe('conflict');
    expect(JSON.stringify(accepted.state)).not.toContain(sha256(shortBody));
  });
});
