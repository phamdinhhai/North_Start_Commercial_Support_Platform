import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OBSERVATION_METADATA_KEYS } from '../../adapters/adaptive-connectivity/observation';
import { OBSERVATION_UPLOAD_KEYS, validateUpload } from '../integration/upload-validation';
import { validateHybridUpload } from '../integration/hybrid-upload';
import {
  digestReadbackEvidence,
  observedAssertionId,
  observedOutcomeAssertion,
  verifyReadbackEvidenceDigest,
} from '../../domain/governed-action/action-outcome-assertion';
import { canonicalJson, sha256Hex, verifyArgumentsDigest } from '../../domain/governed-action/canonical-json';
import { replayLifecycle } from '../../domain/governed-action/action-history';
import { verifyPreviewDigest } from '../../domain/governed-action/action-lifecycle';
import type { ActionActor, JsonValue } from '../../domain/governed-action/governed-action.types';
import { validDeliveryEnvelope } from '../../infra/governed-action/assertion-envelope.validation';
import { PgAssertionDelivery, PgAssertionInbox } from '../../infra/governed-action/pg-assertion-delivery';
import { createSyntheticActionPorts } from '../../infra/governed-action/synthetic-runtime';
import type { ActionVerifier } from '../../ports/governed-action';
import { compareDigests, createHmacContentDigester, InMemoryWorkspaceKeyring, validContentDigest } from '../../ports/content-digester';
import { decodeDigest, digestAsContent, encodeDigest } from '../../ports/versioned-content-digest';
import type { SqlExecutor } from '../../infra/postgres/postgres.service';
import { GovernedActionService } from './governed-action.service';

const NOW = new Date('2026-11-26T10:00:00.000Z');
const CAP = 'ads.campaign.budget.update';
const LEAD = '7f1c2a9e-4b6d-4c1a-9f3e-2d5b8a7c6e10';
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });

function makeKeyring() {
  const ring = new InMemoryWorkspaceKeyring();
  ring.rotate('ws-a', 'ws-a.k1', randomBytes(32));
  ring.rotate('ws-b', 'ws-b.k1', randomBytes(32));
  return { ring, digester: createHmacContentDigester(ring) };
}

function buildService(workspaceId: string, digester: ReturnType<typeof createHmacContentDigester>, evidence: JsonValue, durable = false) {
  const alice: ActionActor = { kind: 'human', id: 'alice', workspaceId };
  const bob: ActionActor = { kind: 'human', id: 'bob', workspaceId };
  const ports = createSyntheticActionPorts({
    enabled: [{ workspaceId, capabilityId: CAP }],
    clock: () => NOW,
    actors: [alice, bob],
    digester,
    policy: {
      constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 600_000 },
      proposers: '*', approvers: ['bob'], executors: ['alice'], readers: '*',
      leadAccess: { [LEAD]: ['alice', 'bob'] },
    },
  });
  ports.ledger.seed({ workspaceId, target }, budget('100000'));
  const verifier: ActionVerifier = {
    readCurrentState: (req) => ports.verifier.readCurrentState(req),
    readback: async (req) => {
      const base = await ports.verifier.readback(req);
      return base.observation === 'UNKNOWN' ? base : { ...base, evidence };
    },
  };
  let queuedAssertion: ReturnType<typeof observedOutcomeAssertion>;
  const store = durable
    ? {
        ...ports.store,
        durableAssertions: true,
        create: ports.store.create.bind(ports.store),
        get: ports.store.get.bind(ports.store),
        events: ports.store.events.bind(ports.store),
        appendRefusal: ports.store.appendRefusal.bind(ports.store),
        refusals: ports.store.refusals.bind(ports.store),
        appendProposalRefusal: ports.store.appendProposalRefusal.bind(ports.store),
        proposalRefusals: ports.store.proposalRefusals.bind(ports.store),
        transition: async (expectedVersion: number, t: Parameters<typeof ports.store.transition>[1], assertion?: Parameters<typeof ports.store.transition>[2]) => {
          if (assertion) queuedAssertion = assertion;
          return ports.store.transition(expectedVersion, t, assertion);
        },
      }
    : ports.store;
  const service = new GovernedActionService({ ...ports, store, verifier, digester, clock: { now: () => NOW } });
  return { alice, bob, ports, service, getQueuedAssertion: () => queuedAssertion };
}

describe('A-02 / ADR-009 — server-side workspace/purpose-keyed HMAC ContentDigester for governed-action evidence', () => {
  it('replaces unkeyed SHA-256 with server-held HMAC-SHA256 (algorithm_version + kid + value) while preserving assertion identity, eligibility, and provenance', async () => {
    const { digester } = makeKeyring();
    const shortCustomerEvidence = { phone: '0901234567', orderCode: 'DH-88', customerReply: 'ok' };
    const unkeyedHex = sha256Hex(canonicalJson(shortCustomerEvidence));

    const { alice, bob, ports, service } = buildService('ws-a', digester, shortCustomerEvidence);
    const proposed = await service.propose(alice, {
      requestKey: 'rk-a02-1', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'r3-a02', leadId: LEAD,
    });
    const previewed = await service.preview(alice, proposed.id);
    await service.authorize(bob, proposed.id, {
      reviewedArgumentDigest: proposed.argumentDigest, reviewedPreviewDigest: previewed.preview!.previewDigest, reason: 'approved',
    });
    const executed = await service.execute(alice, proposed.id);
    expect(executed.state).toBe('SUCCEEDED_VERIFIED');

    const [envelope] = ports.assertions.envelopes;
    expect(envelope).toBeDefined();
    // Preserved technical assertion identity, eligibility, and provenance (ADR-005 + I-05/I-12)
    expect(envelope.assertionId).toBe(observedAssertionId('ws-a', proposed.id, 5));
    expect(envelope).toMatchObject({
      workspaceId: 'ws-a',
      subjectType: 'lead',
      subjectId: LEAD,
      eventType: 'ACTION_OUTCOME_OBSERVED',
      value: 'EXECUTED',
      acquisitionMode: 'observed',
      assertionStatus: 'claimed',
      sourceSystem: 'synthetic-ads',
      sourceRecordId: 'synthetic-op-1',
      sourceActor: 'governed-action-readback',
      createdBy: 'governed-action-runtime',
      rawEvidencePointer: `governed_action_event:${proposed.id}#5`,
      schemaVersion: 1,
    });
    expect(envelope).not.toHaveProperty('inferredMeaning');
    expect(envelope).not.toHaveProperty('confidence');

    // Structured KID / algorithm / value metadata + self-describing token; no unkeyed SHA-256 leak
    expect(envelope.rawPayloadDigest).toEqual({
      algorithm_version: 'hmac-sha256-v1',
      kid: 'ws-a.k1',
      value: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(envelope.rawPayloadHash).toBe(encodeDigest(envelope.rawPayloadDigest!));
    expect(decodeDigest(envelope.rawPayloadHash!)).toEqual(envelope.rawPayloadDigest);
    expect(validContentDigest(digestAsContent(envelope.rawPayloadDigest!))).toBe(true);
    expect(JSON.stringify(envelope)).not.toContain(unkeyedHex);
    expect(verifyReadbackEvidenceDigest('ws-a', shortCustomerEvidence, envelope.rawPayloadDigest!, digester)).toBe(true);
    expect(validDeliveryEnvelope(envelope, 'ws-a', envelope.assertionId)).toBe(true);
  });

  it('enforces workspace and purpose separation even if key bytes and kid are identical across workspaces', async () => {
    const sharedSecret = randomBytes(32);
    const ring = new InMemoryWorkspaceKeyring();
    ring.rotate('ws-a', 'shared-kid', sharedSecret);
    ring.rotate('ws-b', 'shared-kid', sharedSecret);
    const digester = createHmacContentDigester(ring);
    const evidence = { phone: '0901234567', message: 'chốt đơn' };
    const canonical = canonicalJson(evidence);

    const runIn = async (ws: string) => {
      const h = buildService(ws, digester, evidence, true);
      const p = await h.service.propose(h.alice, { requestKey: 'rk-sep', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'sep' });
      const pv = await h.service.preview(h.alice, p.id);
      await h.service.authorize(h.bob, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: pv.preview!.previewDigest, reason: 'ok' });
      await h.service.execute(h.alice, p.id);
      return { proposal: await h.service.get(h.alice, p.id), assertion: h.getQueuedAssertion()! };
    };

    const a = await runIn('ws-a');
    const b = await runIn('ws-b');

    // Cross-workspace separation: identical customer content produces distinct digests
    expect(a.assertion.rawPayloadDigest!.kid).toBe('shared-kid');
    expect(b.assertion.rawPayloadDigest!.kid).toBe('shared-kid');
    expect(a.assertion.rawPayloadDigest!.value).not.toBe(b.assertion.rawPayloadDigest!.value);
    expect(a.assertion.rawPayloadHash).not.toBe(b.assertion.rawPayloadHash);
    expect(a.proposal.argumentDigest).not.toBe(b.proposal.argumentDigest);
    expect(verifyReadbackEvidenceDigest('ws-b', evidence, a.assertion.rawPayloadDigest!, digester)).toBe(false);

    // Purpose separation within the same workspace + key: readback != action-arguments != action-preview != message != envelope != frame != receipt != command
    const purposes = ['frame', 'message', 'receipt', 'envelope', 'action-arguments', 'action-preview', 'readback', 'command'] as const;
    const values = purposes.map((purpose) => digester.digest('ws-a', purpose, canonical).value);
    expect(new Set(values).size).toBe(purposes.length);
    expect(a.assertion.rawPayloadDigest!.value).toBe(digester.digest('ws-a', 'readback', canonical).value);
  });

  it('canonicalizes nested readback evidence deterministically and rejects non-JSON values', () => {
    const { digester } = makeKeyring();
    const orderA = { outer: { z: [1, { b: 'ok', a: '0901234567' }], a: true }, nullField: null, zero: -0 };
    const orderB = { zero: 0, nullField: null, outer: { a: true, z: [1, { a: '0901234567', b: 'ok' }] } };
    const reorderedArray = { zero: 0, nullField: null, outer: { a: true, z: [{ a: '0901234567', b: 'ok' }, 1] } };

    const dA = digestReadbackEvidence('ws-a', orderA, digester);
    const dB = digestReadbackEvidence('ws-a', orderB, digester);
    const dArray = digestReadbackEvidence('ws-a', reorderedArray, digester);

    expect(dA).toEqual(dB);
    expect(dA.value).not.toBe(dArray.value);
    expect(digestReadbackEvidence('ws-a', undefined, digester)).toEqual(digestReadbackEvidence('ws-a', null, digester));
    expect(() => digestReadbackEvidence('ws-a', { bad: Number.NaN }, digester)).toThrow(expect.objectContaining({ code: 'INVALID_ARGUMENTS' }));
  });

  it('preserves recorded kid across key rotation and returns UNKNOWN (never false match/mismatch) when historical key is missing', async () => {
    const ring = new InMemoryWorkspaceKeyring();
    ring.rotate('ws-a', 'kid-2026-10', randomBytes(32));
    const digester = createHmacContentDigester(ring);
    const evidence = { orderCode: 'ORD-101', phone: '0912345678' };

    const h = buildService('ws-a', digester, evidence);
    const p = await h.service.propose(h.alice, { requestKey: 'rk-rot-1', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'rot' });
    const pv = await h.service.preview(h.alice, p.id);

    // Rotate active workspace key before authorize & execute: existing proposal/preview still verify under kid-2026-10,
    // while the newly emitted readback assertion uses the rotated active kid-2026-11.
    ring.rotate('ws-a', 'kid-2026-11', randomBytes(32));
    await h.service.authorize(h.bob, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: pv.preview!.previewDigest, reason: 'ok' });
    const done = await h.service.execute(h.alice, p.id);
    expect(done.state).toBe('SUCCEEDED_VERIFIED');
    const events = await h.service.history(h.alice, p.id);
    expect(replayLifecycle(events, digester).state).toBe('SUCCEEDED_VERIFIED');

    const [firstAssertion] = h.ports.assertions.envelopes;
    expect(decodeDigest(p.argumentDigest)?.kid).toBe('kid-2026-10');
    expect(decodeDigest(pv.preview!.previewDigest)?.kid).toBe('kid-2026-10');
    expect(firstAssertion.rawPayloadDigest?.kid).toBe('kid-2026-11');

    // Rotate again: retired keys remain verifiable under their recorded kids, incomparable across kids
    ring.rotate('ws-a', 'kid-2026-12', randomBytes(32));
    const freshDigest = digestReadbackEvidence('ws-a', evidence, digester);
    expect(freshDigest.kid).toBe('kid-2026-12');
    expect(compareDigests(digestAsContent(firstAssertion.rawPayloadDigest!), digestAsContent(freshDigest))).toBe('incomparable');
    expect(verifyReadbackEvidenceDigest('ws-a', evidence, firstAssertion.rawPayloadDigest!, digester)).toBe(true);
    expect(verifyReadbackEvidenceDigest('ws-a', { orderCode: 'TAMPERED' }, firstAssertion.rawPayloadDigest!, digester)).toBe(false);

    // Simulate a fresh keyring where historical keys (kid-2026-10, kid-2026-11) were lost/unavailable (I-08 UNKNOWN)
    const missingHistoryRing = new InMemoryWorkspaceKeyring();
    missingHistoryRing.rotate('ws-a', 'kid-2026-99', randomBytes(32));
    const digesterMissingOld = createHmacContentDigester(missingHistoryRing);

    expect(verifyReadbackEvidenceDigest('ws-a', evidence, firstAssertion.rawPayloadDigest!, digesterMissingOld)).toBe('UNKNOWN');
    expect(verifyReadbackEvidenceDigest('ws-a', evidence, firstAssertion.rawPayloadHash!, digesterMissingOld)).toBe('UNKNOWN');
    expect(verifyArgumentsDigest(p, digesterMissingOld)).toBe('UNKNOWN');
    expect(verifyPreviewDigest(
      p.argumentDigest, pv.preview!.beforeState, pv.preview!.changes, pv.preview!.evidence,
      'ws-a', pv.preview!.previewDigest, digesterMissingOld,
    )).toBe('UNKNOWN');

    // Consequential authorize/execute fail closed with DIGEST_MISMATCH + explicit DIGEST_KEY_UNKNOWN detail
    const staleService = new GovernedActionService({ ...h.ports, digester: digesterMissingOld, clock: { now: () => NOW } });
    await expect(staleService.preview(h.alice, p.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    const p2 = await h.service.propose(h.alice, { requestKey: 'rk-rot-2', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'rot2' });
    await expect(staleService.preview(h.alice, p2.id)).rejects.toMatchObject({
      code: 'DIGEST_MISMATCH',
      details: ['DIGEST_KEY_UNKNOWN'],
    });
  });

  it('delivers keyed outcome assertions through durable outbox/inbox validation and rejects unkeyed or mismatched digests', async () => {
    const { digester } = makeKeyring();
    const h = buildService('ws-a', digester, { phone: '0987654321' }, true);
    const p = await h.service.propose(h.alice, { requestKey: 'rk-deliv', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'deliv' });
    const pv = await h.service.preview(h.alice, p.id);
    await h.service.authorize(h.bob, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: pv.preview!.previewDigest, reason: 'ok' });
    await h.service.execute(h.alice, p.id);

    const assertion = h.getQueuedAssertion()!;
    expect(validDeliveryEnvelope(assertion, 'ws-a', assertion.assertionId)).toBe(true);

    // Rejects unkeyed SHA-256 or missing/tampered rawPayloadDigest on ACTION_OUTCOME_OBSERVED
    const unkeyed = { ...assertion, rawPayloadHash: 'a'.repeat(64) };
    delete (unkeyed as Record<string, unknown>).rawPayloadDigest;
    expect(validDeliveryEnvelope(unkeyed, 'ws-a', assertion.assertionId)).toBe(false);
    expect(validDeliveryEnvelope({ ...assertion, rawPayloadDigest: { ...assertion.rawPayloadDigest!, kid: 'other-kid' } }, 'ws-a', assertion.assertionId)).toBe(false);
    expect(validDeliveryEnvelope({ ...assertion, rawPayloadDigest: { ...assertion.rawPayloadDigest!, value: 'b'.repeat(64) } }, 'ws-a', assertion.assertionId)).toBe(false);

    // PgAssertionDelivery + PgAssertionInbox accept the keyed envelope end-to-end with mocked SQL executor
    const inboxRows: string[] = [];
    const db: SqlExecutor = {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('WITH ready AS')) {
          return { rows: [{ workspace_id: 'ws-a', assertion_id: assertion.assertionId, envelope: assertion, attempts: 1, lease_token: 'lease-1' }], rowCount: 1 } as never;
        }
        if (sql.includes('INSERT INTO assertion_inbox')) {
          inboxRows.push(String(params?.[2]));
          return { rows: [{ assertion_id: assertion.assertionId }], rowCount: 1 } as never;
        }
        return { rows: [], rowCount: 1 } as never;
      },
    };
    const worker = new PgAssertionDelivery(db, new PgAssertionInbox(db), { batchSize: 5, maxAttempts: 2, leaseMs: 1_000, timeoutMs: 200, backoffMs: 10 });
    expect(await worker.runOnce()).toBe(1);
    expect(JSON.parse(inboxRows[0])).toMatchObject({
      assertionId: assertion.assertionId,
      rawPayloadHash: assertion.rawPayloadHash,
      rawPayloadDigest: { algorithm_version: 'hmac-sha256-v1', kid: 'ws-a.k1' },
    });
  });

  it('rejects browser body-derived digests at upload boundaries and keeps browser runtime digest-free (ADR-009 §2)', async () => {
    const scope = { workspaceId: 'ws-a', connectionId: 'conn-1', accountId: 'acct-1', providerSurface: 'pancake-conversations' as const, pageId: 'page-1' };
    const baseObservation = {
      scope: { workspaceId: 'ws-a', connectionId: 'conn-1', accountId: 'acct-1', providerSurface: 'pancake-conversations' },
      captureId: 'cap-1', sourceRevision: 'rev-1', externalEventId: null, externalObjectId: 'conv-1',
      eventType: 'pages:update_messages', method: 'browser-websocket', evidenceType: 'client-observed',
      authenticity: 'UNKNOWN', completeness: 'UNKNOWN', occurredAt: null, observedAt: '2026-11-26T10:00:00.000Z',
    };
    expect([...OBSERVATION_UPLOAD_KEYS]).not.toContain('payloadHash');
    expect([...OBSERVATION_METADATA_KEYS]).not.toContain('payloadHash');
    const bodyHash = createHash('sha256').update('0901234567').digest('hex');

    for (const smuggled of ['payloadHash', 'payloadDigest', 'contentDigest', 'rawPayloadHash']) {
      expect(() => validateUpload({
        captureId: 'cap-1', sequence: 1, pageId: 'page-1',
        observation: { ...baseObservation, [smuggled]: bodyHash },
      }, scope)).toThrow(expect.objectContaining({ code: 'INPUT_INVALID' }));
    }

    const hybridClaim = {
      id: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-11-27T00:00:00.000Z',
      scope: { ...scope, target: { pageId: 'fixture-page', conversationId: 'fixture-conv' } },
    };
    const validHybridObs = {
      schemaVersion: 1, captureId: 'cap-1', provider: 'pancake', providerSurface: 'pancake-conversations',
      method: 'browser-dom', authenticity: 'CLIENT_OBSERVED', completeness: 'UNKNOWN', sourceRevision: 'rev-1',
      observedAt: '2026-11-26T10:00:00.000Z',
      scope: { workspaceId: 'ws-a', connectionId: 'conn-1', accountId: 'acct-1' },
      native: { accountId: 'acct-1', pageId: 'fixture-page', conversationId: 'fixture-conv' },
    };
    expect(() => validateHybridUpload({
      captureId: 'cap-1', enrollmentId: hybridClaim.id, sequence: 1,
      observation: { ...validHybridObs, payloadDigest: bodyHash },
    }, hybridClaim)).toThrow(expect.objectContaining({ code: 'INPUT_INVALID' }));

    for (const rel of ['../../adapters/browser-companion/protocol.mjs', '../../adapters/hybrid-browser-runtime/dom-observer.js']) {
      const src = await readFile(resolve(__dirname, rel), 'utf8');
      expect(src).not.toMatch(/crypto\.subtle|createHmac|createHash|payloadHash|rawPayloadHash/);
    }
  });
});
