import { describe, expect, it } from 'vitest';
import type { SourceConnection, SourceObservation } from '../../ports/source-observation';
import type { SourceTrustObservation } from '../../ports/source-trust';
import { validateSourceObservation } from '../source-integration/validation';
import { JsonLogger } from '../../infra/observability/json-logger';
import { assertSyntheticSourceAdmission, assertSyntheticNativeIdentity, projectSourceTrust } from './source-trust';

const connection: SourceConnection = { id: 'local', workspaceId: 'workspace-a', provider: 'meta-page',
  route: 'meta-page-synthetic', pageId: 'page-a', status: 'active', health: 'SYNTHETIC_ONLY' };
const context = { workspaceId: 'workspace-a', connection };
const observation = (): SourceObservation => ({ schemaVersion: 1, provider: 'meta-page', route: 'meta-page-synthetic',
  accountId: 'page-a', synthetic: true, sourceAuthority: 'synthetic_fixture', verification: 'UNVERIFIED',
  completeness: 'UNKNOWN', receiptId: 'invented-receipt', observedAt: '2026-11-20T00:00:00Z', occurredAt: null,
  lifecycle: 'upsert-observed', displayName: 'Invented episode',
  native: { system: 'meta', pageId: 'page-a', conversationId: null, messageId: 'invented-message', eventId: 'invented-event', revision: null },
  rawPayload: { utterance: 'invented@example.invalid', speaker: 'customer', original: { token: 'invented-sensitive-value' } } });

describe('synthetic source trust adversarial boundary', () => {
  it('separates local admission from provider attestation and never rewrites historical observations', () => {
    const o = observation(), before = structuredClone(o);
    expect(projectSourceTrust(o, context)).toMatchObject({ authority: 'LOCAL_SYNTHETIC_FIXTURE',
      verification: 'UNVERIFIED', nativeMapping: 'USER_ASSERTED_CANDIDATE',
      providerAttestation: 'NOT_AVAILABLE', independentVerification: 'NOT_AVAILABLE' });
    expect(projectSourceTrust(o)).toMatchObject({ authority: 'LEGACY_UNVERIFIED', transportIdentity: 'UNKNOWN' });
    expect(o).toEqual(before);
  });
  it('rejects forged labels at intake and cannot project provider assurance even from forged legacy metadata', () => {
    for (const change of [{ verification: 'VERIFIED' }, { sourceAuthority: 'provider_authenticated' }, { synthetic: false }]) {
      const forged = { ...observation(), ...change };
      expect(() => validateSourceObservation(forged)).toThrow('INPUT_INVALID');
      expect(() => assertSyntheticSourceAdmission(forged as SourceTrustObservation, context)).toThrow('SOURCE_TRUST_INVALID');
      expect(projectSourceTrust(forged as SourceTrustObservation)).toMatchObject({ verification: 'UNVERIFIED',
        authority: 'LEGACY_UNVERIFIED', providerAttestation: 'NOT_AVAILABLE' });
    }
  });
  it('rejects cross-workspace, cross-account, provider-route substitution and revoked replay before trust projection', () => {
    expect(() => projectSourceTrust(observation(), { ...context, workspaceId: 'workspace-b' })).toThrow('CONNECTION_NOT_FOUND');
    expect(() => projectSourceTrust(observation(), { ...context, connection: { ...connection, status: 'revoked' } })).toThrow('CONNECTION_REVOKED');
    for (const change of [{ accountId: 'page-b' }, { provider: 'pancake' }, { route: 'pancake-synthetic' }]) {
      expect(() => projectSourceTrust({ ...observation(), ...change } as SourceTrustObservation, context)).toThrow('SOURCE_SCOPE_MISMATCH');
    }
  });
  it('rejects impossible native combinations while allowing incomplete unknown identities', () => {
    const o = observation();
    for (const change of [{ system: 'pancake' }, { pageId: 'page-b' }, { eventId: null, revision: 'r2' }]) {
      expect(() => assertSyntheticNativeIdentity({ ...o, native: { ...o.native, ...change } } as SourceTrustObservation)).toThrow('SOURCE_NATIVE_INVALID');
    }
    const unknown = { ...o, native: { system: null, pageId: null, messageId: null, conversationId: null, eventId: null, revision: null } };
    expect(projectSourceTrust(unknown, context).nativeMapping).toBe('UNKNOWN');
    expect(projectSourceTrust({ ...o, native: { ...o.native, system: null } }, context).nativeMapping).toBe('UNKNOWN');
  });
  it('preserves the explicit Pancake/Meta fabricated alignment demonstration as a candidate', () => {
    const o: SourceObservation = { ...observation(), provider: 'pancake', route: 'pancake-synthetic', accountId: 'pancake-page' };
    const c: SourceConnection = { ...connection, provider: 'pancake', route: 'pancake-synthetic', pageId: 'pancake-page' };
    expect(projectSourceTrust(o, { ...context, connection: c })).toMatchObject({
      nativeMapping: 'USER_ASSERTED_CANDIDATE', verification: 'UNVERIFIED' });
    const replay = projectSourceTrust(o, { ...context, connection: c });
    expect(replay.providerAttestation).toBe('NOT_AVAILABLE');
  });
  it('does not expose raw payload, identities or exception data through projection and operational logs', () => {
    const o = observation(), lines: string[] = [], logger = new JsonLogger(line => lines.push(line));
    logger.event('warn', { event: 'source.rejected', body: o, token: o.rawPayload.original.token, observation: o });
    logger.error(new Error(o.rawPayload.utterance));
    const serialized = JSON.stringify({ trust: projectSourceTrust(o, context), lines });
    for (const value of [o.rawPayload.utterance, o.rawPayload.original.token, o.native.messageId, o.receiptId]) {
      expect(serialized).not.toContain(value);
    }
    expect(lines).toHaveLength(2);
  });
});
