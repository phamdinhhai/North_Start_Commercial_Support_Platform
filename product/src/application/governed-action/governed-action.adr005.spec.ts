import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { observedOutcomeAssertion } from '../../domain/governed-action/action-outcome-assertion';
import { previewDigestOf } from '../../domain/governed-action/action-lifecycle';
import type {
  ActionActor, ActionPrincipal, CommercialEventFacts, ObservedState, PreviewChange,
} from '../../domain/governed-action/governed-action.types';
import type { AssertionSink, CommercialEventLookup } from '../../ports/governed-action';
import { createSyntheticActionPorts } from '../../infra/governed-action/synthetic-runtime';
import { GovernedActionService, type GovernedActionDeps } from './governed-action.service';

/** ADR-005 (CE-2 resolved): R2-P-01 evidence-bound AI proposals, R2-P-02 observed outcome assertions. */
const WS = 'ws-a';
const actor = (kind: ActionActor['kind'], id: string, workspaceId = WS): ActionActor => ({ kind, id, workspaceId });
const alice = actor('human', 'alice');
const bob = actor('human', 'bob');
const drafter = actor('ai', 'ai-drafter');
const LEAD = '7f1c2a9e-4b6d-4c1a-9f3e-2d5b8a7c6e10';
const OTHER_LEAD = '0b6f6b0e-3d0e-4a59-8f53-0f2a4f6c1d22';
const CE = 'c0ffee00-0000-4000-8000-000000000001';
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const CAP = 'ads.campaign.budget.update';
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });
const code = (promise: Promise<unknown>) => promise.then(() => 'RESOLVED', (e: { code?: string }) => e.code ?? String(e));
const draftCe = (over: Partial<CommercialEventFacts> = {}): CommercialEventFacts => ({
  id: CE, workspaceId: WS, leadId: LEAD, acquisitionMode: 'inferred', assertionStatus: 'draft', policyCheck: 'pending',
  evidencePointers: ['envelope:7d1e', 'pancake:conv-9#msg-3'], ...over,
});

function harness(overrides: Partial<GovernedActionDeps> = {}, ces: readonly CommercialEventFacts[] = [draftCe()]) {
  let now = new Date('2026-11-18T09:00:00.000Z');
  const clock = { now: () => new Date(now) };
  const ports = createSyntheticActionPorts({
    enabled: [{ workspaceId: WS, capabilityId: CAP }], clock: clock.now, actors: [alice, bob, drafter],
    commercialEvents: ces,
    policy: {
      constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 15 * 60_000 },
      proposers: '*', approvers: ['bob'], executors: ['alice'], readers: '*', leadAccess: { [LEAD]: ['alice', 'bob', 'ai-drafter'] },
    },
  });
  ports.ledger.seed({ workspaceId: WS, target }, budget('100000'));
  const emit = vi.spyOn(ports.assertions, 'emit');
  const service = new GovernedActionService({ ...ports, clock, executionTimeoutMs: 30, readbackTimeoutMs: 30, ...overrides });
  const propose = (by: ActionPrincipal, extra: { leadId?: string; commercialEventRef?: string; evidenceRefs?: readonly string[]; requestKey?: string } = {}) =>
    service.propose(by, { requestKey: extra.requestKey ?? `rk-${Math.random()}`, capabilityId: CAP, target, arguments: budget('110000'),
      rationale: 'adr-005', ...extra });
  const authorize = async (id: string) => {
    const p = await service.preview(alice, id);
    return service.authorize(bob, id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok' });
  };
  return { service, ports, emit, propose, authorize, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

describe('ADR-005 R2-P-01 — AI proposals must cite a draft inferred CommercialEvent with evidence', () => {
  it('an AI proposal without a commercialEventRef is refused with EVIDENCE_REQUIRED, logged, and nothing is stored', async () => {
    const h = harness();
    const create = vi.spyOn(h.ports.store, 'create');
    expect(await code(h.propose(drafter, { leadId: LEAD, requestKey: 'rk-ai-1' }))).toBe('EVIDENCE_REQUIRED');
    expect(create).not.toHaveBeenCalled();
    const log = await h.ports.store.proposalRefusals(WS);
    expect(log).toEqual([expect.objectContaining({ requestKey: 'rk-ai-1', capabilityId: CAP, leadId: LEAD, code: 'EVIDENCE_REQUIRED',
      actor: { kind: 'ai', id: 'ai-drafter' }, details: ['COMMERCIAL_EVENT_REF_MISSING'] })]);
    // A smuggled workspace in the command body never redirects the refusal log (I-09).
    const smuggled = { requestKey: 'rk-ai-2', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'x', workspaceId: 'ws-b' };
    expect(await code(h.service.propose(drafter, smuggled as Parameters<typeof h.service.propose>[1]))).toBe('EVIDENCE_REQUIRED');
    expect(await h.ports.store.proposalRefusals('ws-b')).toEqual([]);
    expect((await h.ports.store.proposalRefusals(WS)).map((r) => r.requestKey)).toEqual(['rk-ai-1', 'rk-ai-2']);
  });

  const failures: readonly [string, CommercialEventFacts[], { leadId?: string; evidenceRefs?: string[] }, string][] = [
    ['foreign workspace', [draftCe({ workspaceId: 'ws-b' })], { leadId: LEAD }, 'COMMERCIAL_EVENT_NOT_FOUND'],
    ['missing', [], { leadId: LEAD }, 'COMMERCIAL_EVENT_NOT_FOUND'],
    ['not a draft', [draftCe({ assertionStatus: 'corroborated' })], { leadId: LEAD }, 'COMMERCIAL_EVENT_NOT_DRAFT'],
    ['provenance unknown', [draftCe({ assertionStatus: 'unknown' })], { leadId: LEAD }, 'COMMERCIAL_EVENT_NOT_DRAFT'],
    ['policy-rejected', [draftCe({ policyCheck: 'rejected' })], { leadId: LEAD }, 'COMMERCIAL_EVENT_REJECTED'],
    ['not inferred', [draftCe({ acquisitionMode: 'observed' })], { leadId: LEAD }, 'COMMERCIAL_EVENT_NOT_INFERRED'],
    ['without evidence', [draftCe({ evidencePointers: [] })], { leadId: LEAD }, 'COMMERCIAL_EVENT_NO_EVIDENCE'],
    ['on another lead', [draftCe({ leadId: OTHER_LEAD })], { leadId: LEAD }, 'COMMERCIAL_EVENT_LEAD_MISMATCH'],
    ['citing evidence the CE does not carry', [draftCe()], { leadId: LEAD, evidenceRefs: ['envelope:forged'] }, 'EVIDENCE_REF_NOT_IN_COMMERCIAL_EVENT'],
  ];
  it.each(failures)('a CE that is %s ⇒ EVIDENCE_REQUIRED (refusal logged, no proposal)', async (_label, ces, extra, detail) => {
    const h = harness({}, ces);
    const create = vi.spyOn(h.ports.store, 'create');
    expect(await code(h.propose(drafter, { ...extra, commercialEventRef: CE }))).toBe('EVIDENCE_REQUIRED');
    expect(create).not.toHaveBeenCalled();
    expect((await h.ports.store.proposalRefusals(WS)).map((r) => [r.code, r.details, r.commercialEventRef]))
      .toEqual([['EVIDENCE_REQUIRED', [detail], CE]]);
  });

  it('a lookup failure fails closed with EVIDENCE_REQUIRED', async () => {
    const broken: CommercialEventLookup = { find: async () => { throw new Error('db down'); } };
    const h = harness({ commercialEvents: broken });
    expect(await code(h.propose(drafter, { leadId: LEAD, commercialEventRef: CE }))).toBe('EVIDENCE_REQUIRED');
    expect((await h.ports.store.proposalRefusals(WS))[0].details).toEqual(['COMMERCIAL_EVENT_LOOKUP_UNAVAILABLE']);
  });

  it('a draft inferred CE with evidence is accepted; refs are frozen on the proposal and in the PROPOSED event', async () => {
    const h = harness();
    const p = await h.propose(drafter, { leadId: LEAD, commercialEventRef: CE.toUpperCase() });
    expect(p).toMatchObject({ commercialEventRef: CE, evidenceRefs: ['envelope:7d1e', 'pancake:conv-9#msg-3'], proposer: { kind: 'ai' } });
    const [proposed] = await h.service.history(alice, p.id);
    expect(proposed.data).toMatchObject({ draft: true, commercialEventRef: CE, evidenceRefs: ['envelope:7d1e', 'pancake:conv-9#msg-3'] });
    const subset = await h.propose(drafter, { leadId: LEAD, commercialEventRef: CE, evidenceRefs: ['pancake:conv-9#msg-3'] });
    expect(subset.evidenceRefs).toEqual(['pancake:conv-9#msg-3']);
  });

  it('human proposals need only a rationale; cited evidence is shown to the approver and bound into the preview digest', async () => {
    const h = harness();
    const bare = await h.propose(alice);
    expect(bare.evidenceRefs).toEqual([]);
    expect(bare.commercialEventRef).toBeUndefined();
    await expect(h.service.propose(alice, { requestKey: 'rk-no-why', capabilityId: CAP, target, arguments: budget('110000'), rationale: ' ' }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });

    const cited = await h.propose(alice, { leadId: LEAD, commercialEventRef: CE, evidenceRefs: ['crm:note-12'] });
    const previewed = await h.service.preview(bob, cited.id);
    expect(previewed.preview?.evidence).toEqual({ commercialEventRef: CE, evidenceRefs: ['crm:note-12'] });
    const ev = (await h.service.history(bob, cited.id)).find((e) => e.type === 'PREVIEWED')!;
    expect(ev.data.evidence).toEqual({ commercialEventRef: CE, evidenceRefs: ['crm:note-12'] });
    const unbound = previewDigestOf(cited.argumentDigest, ev.data.beforeState as unknown as ObservedState, ev.data.changes as unknown as PreviewChange[], undefined, WS);
    expect(previewed.preview?.previewDigest).not.toBe(unbound);
  });

  it('a human citing a foreign CE is refused; malformed refs are invalid input; a replay with different evidence conflicts', async () => {
    const h = harness({}, [draftCe({ workspaceId: 'ws-b' })]);
    expect(await code(h.propose(alice, { commercialEventRef: CE }))).toBe('EVIDENCE_REQUIRED');
    expect(await code(h.propose(alice, { evidenceRefs: ['has space'] }))).toBe('INVALID_INPUT');
    expect(await code(h.propose(alice, { commercialEventRef: 'not-a-uuid' }))).toBe('INVALID_INPUT');
    expect(await code(h.propose(alice, { evidenceRefs: Array.from({ length: 21 }, (_, i) => `ref-${i}`) }))).toBe('INVALID_INPUT');
    await h.propose(alice, { requestKey: 'rk-same', evidenceRefs: ['crm:a'] });
    expect(await code(h.propose(alice, { requestKey: 'rk-same', evidenceRefs: ['crm:b'] }))).toBe('REQUEST_KEY_CONFLICT');
  });
});

describe('ADR-005 R2-P-02 — a verified outcome emits an observed AssertionEnvelope and never moves Commercial State', () => {
  it('SUCCEEDED_VERIFIED emits one observed envelope: provider source, providerReference, readback evidence', async () => {
    const h = harness();
    const p = await h.authorize((await h.propose(alice, { leadId: LEAD, commercialEventRef: CE })).id);
    const done = await h.service.execute(alice, p.id);
    expect(done.state).toBe('SUCCEEDED_VERIFIED');
    expect(h.emit).toHaveBeenCalledTimes(1);
    const [env] = h.ports.assertions.envelopes;
    expect(env).toMatchObject({
      workspaceId: WS, subjectType: 'lead', subjectId: LEAD, eventType: 'ACTION_OUTCOME_OBSERVED', value: 'EXECUTED',
      acquisitionMode: 'observed', assertionStatus: 'claimed', sourceSystem: 'synthetic-ads', sourceRecordId: 'synthetic-op-1',
      capturedAt: done.outcome!.verification!.observedAt, rawEvidencePointer: `governed_action_event:${p.id}#5`,
      rawPayloadHash: expect.stringMatching(/^hmac-sha256-v1:/), schemaVersion: 1,
      evidenceSummary: expect.objectContaining({ proposalId: p.id, capabilityId: CAP, attempt: 1, outcome: 'SUCCEEDED_VERIFIED',
        observation: 'EXECUTED', executorStatus: 'APPLIED', commercialEventRef: CE }),
    });
    expect(env).not.toHaveProperty('inferredMeaning');
    expect(env).not.toHaveProperty('confidence');
  });

  it('FAILED_VERIFIED emits an observed NOT_EXECUTED envelope without a provider record id; non-lead actions use the external resource', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'reject';
    const p = await h.authorize((await h.propose(alice)).id);
    expect((await h.service.execute(alice, p.id)).state).toBe('FAILED_VERIFIED');
    const [env] = h.ports.assertions.envelopes;
    expect(env).toMatchObject({ value: 'NOT_EXECUTED', subjectType: 'external_resource', subjectId: 'synthetic-ads/acct-1/campaign/cmp-1',
      evidenceSummary: expect.objectContaining({ outcome: 'FAILED_VERIFIED', executorStatus: 'NOT_APPLIED' }) });
    expect(env).not.toHaveProperty('sourceRecordId');
  });

  it('UNKNOWN emits nothing; verify resolving it emits exactly once; a kill switch before dispatch emits nothing', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'apply-then-hang';
    const p = await h.authorize((await h.propose(alice)).id);
    expect((await h.service.execute(alice, p.id)).state).toBe('UNKNOWN');
    expect(h.emit).not.toHaveBeenCalled();
    expect((await h.service.verify(alice, p.id)).state).toBe('SUCCEEDED_VERIFIED');
    expect(h.ports.assertions.envelopes.map((e) => [e.value, e.rawEvidencePointer])).toEqual([['EXECUTED', `governed_action_event:${p.id}#6`]]);

    const k = harness();
    const q = await k.authorize((await k.propose(alice)).id);
    const status = vi.spyOn(k.ports.killSwitch, 'status');
    // first look (execute gate) passes; the last look right before dispatch is engaged
    status.mockResolvedValueOnce({ engaged: false }).mockResolvedValue({ engaged: true, scope: 'global', reason: 'stop' });
    expect((await k.service.execute(alice, q.id)).state).toBe('FAILED_VERIFIED');
    expect(k.emit).not.toHaveBeenCalled();
  });

  it('a sink failure never undoes the verified outcome, and the assertion id is deterministic (idempotent re-emission)', async () => {
    const failing: AssertionSink = { emit: async () => { throw new Error('sink down'); } };
    const h = harness({ assertions: failing });
    const p = await h.authorize((await h.propose(alice)).id);
    const done = await h.service.execute(alice, p.id);
    expect(done.state).toBe('SUCCEEDED_VERIFIED');
    const events = await h.service.history(alice, p.id);
    const outcome = events[events.length - 1];
    const a = observedOutcomeAssertion(done, outcome, new Date('2026-11-18T10:00:00Z'));
    const b = observedOutcomeAssertion(done, outcome, new Date('2026-11-18T11:00:00Z'));
    expect(a?.assertionId).toBe(b?.assertionId);
    expect(a?.assertionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(observedOutcomeAssertion(done, events[0], new Date())).toBeUndefined();
  });

  it('no Commercial State port is reachable: only governed-action ports are called, and the code imports no state module', async () => {
    const calls: string[] = [];
    const h = harness();
    const traced = Object.fromEntries(Object.entries(h.ports).map(([name, port]) => [name,
      typeof port === 'object' && port !== null && !Object.isFrozen(port) ? new Proxy(port, { get(t, prop, recv) {
        const v = Reflect.get(t, prop, recv);
        return typeof v === 'function' ? (...args: unknown[]) => { calls.push(`${name}.${String(prop)}`); return v.apply(t, args); } : v;
      } }) : port]));
    const service = new GovernedActionService({ ...(traced as unknown as GovernedActionDeps), clock: { now: () => new Date('2026-11-18T09:00:00Z') } });
    const p = await service.propose(alice, { requestKey: 'rk-trace', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'trace', leadId: LEAD, commercialEventRef: CE });
    const v = await service.preview(alice, p.id);
    await service.authorize(bob, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: v.preview!.previewDigest, reason: 'ok' });
    expect((await service.execute(alice, p.id)).state).toBe('SUCCEEDED_VERIFIED');
    const ports = new Set(calls.map((c) => c.split('.')[0]));
    // The frozen capability catalog is not traced; every other dependency is a governed-action port.
    expect([...ports].sort()).toEqual(['actors', 'assertions', 'commercialEvents', 'enablement', 'executor', 'killSwitch', 'policy', 'store', 'verifier']);
    expect(calls.filter((c) => c.startsWith('commercialEvents.'))).toEqual(['commercialEvents.find']);
    expect(calls.filter((c) => c.startsWith('assertions.'))).toEqual(['assertions.emit']);

    const SRC = resolve(__dirname, '../..');
    const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]);
    const owned = ['domain/governed-action', 'application/governed-action', 'infra/governed-action'].flatMap((d) => files(resolve(SRC, d)))
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
    const offenders = owned.filter((f) => /lead\/lead-state|domain\/outcome|pilot-loop\.store|pilot-loop\.service/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split(sep).join('/'));
    expect(offenders).toEqual([]);
    expect(readFileSync(resolve(SRC, 'application/governed-action/governed-action.service.ts'), 'utf8')).toMatch(/OPEN: CE-1/);
  });
});
