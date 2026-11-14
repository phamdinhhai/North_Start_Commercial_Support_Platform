import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PilotDomainError } from '../ports/pilot-loop.types';
import { PilotLoopController } from './pilot-loop.controller';
import { AuthService } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { PilotLoopService } from '../application/pilot/pilot-loop.service';
import { InMemoryPilotStore } from '../infra/pilot/in-memory-pilot.store';
import { AuditStore } from '../infra/audit/audit-store';
import { ManualAdapter } from '../adapters/manual/manual-adapter';

const demoHeaders = { 'x-demo-workspace': 'ws-demo' };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64');
const salesA = { authorization: `Bearer ${b64({ workspaceId: 'ws-a', userId: 'marketing-a', role: 'sales' })}` };
const salesB = { authorization: `Bearer ${b64({ workspaceId: 'ws-a', userId: 'sales-b', role: 'sales' })}` };
const salesC = { authorization: `Bearer ${b64({ workspaceId: 'ws-a', userId: 'sales-c', role: 'sales' })}` };
const foreign = { authorization: `Bearer ${b64({ workspaceId: 'ws-b', userId: 'sales-9', role: 'sales' })}` };

function makeController(): PilotLoopController {
  process.env.DEMO_WORKSPACES = 'true'; // demo sandboxes are opt-in; this suite exercises them
  const audit = new AuditStore();
  const store = new InMemoryPilotStore(audit);
  return new PilotLoopController(new AuthService(), new RbacService(), new PilotLoopService(store, new ManualAdapter()));
}

describe('PilotLoopController — auth & RBAC wiring (T3-03/T3-04 unit-level; LIVE HTTP evidence = scripts/pilot-smoke.sh, PG durability = pilot-loop.integration.spec.ts)', () => {
  let ctrl: PilotLoopController;

  beforeEach(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    ctrl = makeController();
  });

  it('rejects unauthenticated non-demo request with 401 (R-02)', async () => {
    await expect(
      ctrl.intake({}, { displayName: 'x', utterance: 'y', speaker: 'customer', connection: 'c', externalRecordId: 'r' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('does not read workspaceId from body — server-derived auth context wins (QA-32)', async () => {
    const res = await ctrl.intake(salesA, {
      displayName: 'Phụ huynh A',
      utterance: 'Thứ Sáu em gọi lại cho chị nhé',
      speaker: 'customer',
      connection: 'manual',
      externalRecordId: 'msg-1',
      workspaceId: 'ws-EVIL', // body attempts to pick workspace
    } as never);
    const view = await ctrl.getLead(salesA, res.leadId);
    expect(view.lead.workspaceId).toBe('ws-a');
  });

  it('cross-workspace access is invisible — 404, not 403 (AC-03, I-09)', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r' });
    await expect(ctrl.getLead(foreign, res.leadId)).rejects.toThrow(NotFoundException);
  });

  it('scopes history and evidence pointers at the HTTP boundary across workspaces', async () => {
    const own = await ctrl.intake(salesA, { displayName: 'own', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-scope-own' });
    const other = await ctrl.intake(foreign, { displayName: 'other', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-scope-other' });

    // A foreign caller cannot turn a known lead id into a history oracle.
    await expect(ctrl.auditHistory(foreign, own.leadId)).rejects.toThrow(NotFoundException);

    const loop = (ctrl as unknown as { loop: PilotLoopService }).loop;
    const foreignEnvelopeId = (await loop.get(other.leadId))?.sourceEnvelopeId;
    expect(foreignEnvelopeId).toBeDefined();

    const handed = await ctrl.handoff(salesA, own.leadId, {
      context: 'c',
      proposedAction: 'gọi lại',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      recipientUserId: 'marketing-a',
    });
    await ctrl.accept(salesA, own.leadId, { workId: handed.workItemId, reason: 'nhận' });

    await expect(ctrl.complete(salesA, own.leadId, {
      workId: handed.workItemId,
      evidence: 'observed',
      evidenceRef: foreignEnvelopeId,
    })).rejects.toMatchObject({ status: 403, response: { code: 'EVIDENCE_OUT_OF_SCOPE' } });

    // A rejected cross-tenant pointer cannot leave a projection or audit artifact behind.
    const view = await ctrl.getLead(salesA, own.leadId);
    expect(view.workItems.find((item) => item.id === handed.workItemId)?.status).toBe('accepted');
    expect((await ctrl.auditHistory(salesA, own.leadId)).history.map((entry) => entry.eventType)).not.toContain('work_completed');
  });

  it('maps one concurrent mutation winner and one stale CAS conflict to HTTP 409', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'cas', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-http-cas' });
    const handed = await ctrl.handoff(salesA, res.leadId, {
      context: 'c',
      proposedAction: 'gọi lại',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      recipientUserId: 'marketing-a',
    });
    await ctrl.accept(salesA, res.leadId, { workId: handed.workItemId, reason: 'nhận' });

    const results = await Promise.allSettled([
      ctrl.advance(salesA, res.leadId, { to: 'Contacting', reason: 'winner candidate' }),
      ctrl.advance(salesA, res.leadId, { to: 'Contacting', reason: 'stale candidate' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { status: 409, response: { code: 'STALE_VERSION' } },
    });

    const view = await ctrl.getLead(salesA, res.leadId);
    expect(view.lead.status).toBe('Contacting');
    const transitions = (await ctrl.auditHistory(salesA, res.leadId)).history.filter(
      (entry) => entry.eventType === 'lead_transition' && entry.newValue === 'Contacting',
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0].reason).not.toBe('stale candidate');
  });

  it('Marketing A → Sales B: B được XEM và ACCEPT gói bàn giao addressed to them (I-09, PM-1 pending)', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r' });
    const handed = await ctrl.handoff(salesA, res.leadId, {
      context: 'c',
      proposedAction: 'Gọi lại',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      recipientUserId: 'sales-b',
    });
    expect(handed.recipient).toBe('sales-b');
    // B xem được gói trước khi accept (recipient quyền xem lead cụ thể này)
    const bView = await ctrl.getLead(salesB, res.leadId);
    expect(bView.handoff?.context).toBe('c');
    // C không liên quan → 403
    await expect(ctrl.getLead(salesC, res.leadId)).rejects.toThrow(ForbiddenException);
    // B accept → owner = B
    const accepted = await ctrl.accept(salesB, res.leadId, { workId: handed.workItemId, reason: 'B nhận' });
    expect(accepted.owner).toBe('sales-b');
    expect(accepted.leadStatus).toBe('Accepted');
  });

  it('demo workspace passes without token (R-02 AC)', async () => {
    const res = await ctrl.intake(demoHeaders, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r' });
    expect(res.status).toBe('New');
    const view = await ctrl.getLead(demoHeaders, res.leadId);
    expect(view.lead.workspaceId).toBe('demo:ws-demo'); // sandboxed, never the raw header value
  });

  it('runs the loop end-to-end over the controller surface', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'Phụ huynh B', utterance: 'Gửi chị học phí nhé', speaker: 'customer', connection: 'manual', externalRecordId: 'msg-2' });
    const handed = await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'Gửi bảng học phí', responsibleParty: 'internal', origin: 'explicit-commitment', recipientUserId: 'sales-b' });
    await ctrl.accept(salesB, res.leadId, { workId: handed.workItemId, reason: 'B nhận' });
    const done = await ctrl.complete(salesB, res.leadId, { workId: handed.workItemId, evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true, reason: 'đã gửi qua Zalo' });
    expect(done.workStatus).toBe('completed');
    expect(done.evidence).toBe('declared');
    expect(done.occurredAt).toBe('unknown'); // Q4: không backfill occurredAt
    const adv1 = await ctrl.advance(salesB, res.leadId, { to: 'Contacting', reason: 'đã gọi' });
    expect(adv1.leadStatus).toBe('Contacting');
    const adv2 = await ctrl.advance(salesB, res.leadId, { to: 'Follow-up', reason: 'chờ phản hồi' });
    expect(adv2.leadStatus).toBe('Follow-up');
    const out = await ctrl.outcome(salesB, res.leadId, { value: 'Won', reason: 'đã deposit' });
    expect(out.leadStatus).toBe('Won');
    expect(out.assertionStatus).toBe('claimed'); // R-15: claim, không tự verified
    const history = await ctrl.auditHistory(salesB, res.leadId);
    expect(history.metadata).toEqual({
      trust: 'recorded',
      provenance: 'audit_record',
      unknown: ['business_truth', 'runtime_causality'],
    });
    expect(history.history.every((entry) => entry.metadata.trust === 'recorded')).toBe(true);
    expect(JSON.stringify(history)).not.toContain('rawPayload');
  });

  it('unexpected errors use an opaque 500 message and do not leak exception text', async () => {
    const unexpected = 'secret SQL, /private/path, and token=should-not-escape';
    const loop = {
      ingestScenario: async () => { throw new Error(unexpected); },
    } as unknown as PilotLoopService;
    const isolated = new PilotLoopController(new AuthService(), new RbacService(), loop);

    await expect(isolated.intake(salesA, {
      displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-internal',
    })).rejects.toMatchObject({
      status: 500,
      response: { code: 'INTERNAL', message: 'internal server error' },
    });
    await expect(isolated.intake(salesA, {
      displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-internal-2',
    })).rejects.not.toThrow(unexpected);
  });

  it('preserves domain error code/status/message while mapping typed failures', async () => {
    const domain = new PilotDomainError('IDEMPOTENCY_CONFLICT', 409, 'same request has different evidence', { requestId: 'r-1' });
    const loop = { ingestScenario: async () => { throw domain; } } as unknown as PilotLoopService;
    const isolated = new PilotLoopController(new AuthService(), new RbacService(), loop);

    await expect(isolated.intake(salesA, {
      displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-domain',
    })).rejects.toMatchObject({
      status: 409,
      response: { code: 'IDEMPOTENCY_CONFLICT', message: 'same request has different evidence', details: { requestId: 'r-1' } },
    });
  });

  it('guardrail refusals map to 4xx business codes, not raw 500', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'em gửi rồi nhé', speaker: 'staff', connection: 'c', externalRecordId: 'r' });
    const handed = await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-commitment', recipientUserId: 'sales-b' });
    // New→Contacting nằm ngoài hypothesis CE-1 → PilotDomainError 422 CE1_BOUNDARY, controller map thành HttpException
    await expect(ctrl.advance(salesA, res.leadId, { to: 'Contacting', reason: 'x' })).rejects.toMatchObject({
      status: 422,
      response: { code: 'CE1_BOUNDARY' },
    });
    await ctrl.accept(salesB, res.leadId, { workId: handed.workItemId, reason: 'B nhận' });
    await expect(ctrl.complete(salesB, res.leadId, { workId: handed.workItemId, evidence: 'observed' })).rejects.toMatchObject({
      status: 422,
      response: { code: 'EVIDENCE_POINTER_REQUIRED' },
    });
  });

  it('external expectation → unobserved endpoint returns awaiting-external, never failure', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-ext' });
    const handed = await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'Chị A trao đổi với bé', responsibleParty: 'external', origin: 'explicit-request', recipientUserId: 'sales-b' });
    await ctrl.accept(salesB, res.leadId, { workId: handed.workItemId, reason: 'B nhận theo dõi kỳ vọng khách' });
    const marked = await ctrl.unobserved(salesB, res.leadId, { workId: handed.workItemId });
    expect(marked.workStatus).toBe('awaiting-external');
    expect(marked.evidence).toBe('absent');
  });
});

/**
 * P1-2 at the HTTP boundary: `authorizedView` (RBAC) is the VIEW gate only. Mutations
 * additionally require current ownership, enforced in the service and surfaced here as a
 * 403 with a machine-readable code — never 200, never a raw 500.
 */
describe('P1-2 — controller separates view / accept / mutation rights', () => {
  let ctrl: PilotLoopController;

  beforeEach(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    ctrl = makeController();
  });

  async function handedOver() {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-p12' });
    const handed = await ctrl.handoff(salesA, res.leadId, {
      context: 'c',
      proposedAction: 'Gọi lại chị A',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      recipientUserId: 'sales-b',
    });
    return { leadId: res.leadId, workItemId: handed.workItemId };
  }

  it('recipient B may view + accept, but every mutation endpoint is 403 NOT_OWNER before acceptance', async () => {
    const { leadId, workItemId } = await handedOver();

    // view OK
    expect((await ctrl.getLead(salesB, leadId)).lead.owner).toBe('marketing-a');

    // mutations by B while owner is A → 403 + code (không 200, không 500)
    await expect(ctrl.complete(salesB, leadId, { workId: workItemId, evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true })).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_OWNER' },
    });
    await expect(ctrl.reschedule(salesB, leadId, { workId: workItemId, newDueAt: '2026-10-12T09:00:00+07:00', reason: 'x' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_OWNER' },
    });
    await expect(ctrl.advance(salesB, leadId, { to: 'Contacting', reason: 'x' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_OWNER' },
    });
    await expect(ctrl.outcome(salesB, leadId, { value: 'Won' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_OWNER' },
    });

    // state unchanged (no half-mutation)
    const view = await ctrl.getLead(salesA, leadId);
    expect(view.lead.status).toBe('New');
    expect(view.workItems[0].status).toBe('proposed');

    // accept remains B's right; after that mutations succeed
    const accepted = await ctrl.accept(salesB, leadId, { workId: workItemId, reason: 'B nhận' });
    expect(accepted.owner).toBe('sales-b');
    const done = await ctrl.complete(salesB, leadId, { workId: workItemId, evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true, reason: 'đã gọi' });
    expect(done.workStatus).toBe('completed');
  });

  it('the previous owner A cannot mutate after handing over to B (ownership moved)', async () => {
    const { leadId, workItemId } = await handedOver();
    await ctrl.accept(salesB, leadId, { workId: workItemId, reason: 'B nhận' });
    // A vẫn XEM được (workspace + từng là owner)? Không: resource.assignedTo giờ là B,
    // A không còn trong recipients → A bị 403 ở gate view của RBAC.
    await expect(ctrl.getLead(salesA, leadId)).rejects.toThrow(ForbiddenException);
    await expect(ctrl.advance(salesA, leadId, { to: 'Contacting', reason: 'x' })).rejects.toThrow(ForbiddenException);
  });

  it('P1-2: owner A cannot accept or complete B’s proposed item; second handoff to C neither lets C accept B’s item nor revokes B’s GET view', async () => {
    const { leadId, workItemId: workB } = await handedOver();

    // A (current owner) cannot accept or complete workB addressed to sales-b
    await expect(ctrl.accept(salesA, leadId, { workId: workB, reason: 'A nhận hộ' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_ASSIGNED_RECIPIENT' },
    });
    await expect(ctrl.complete(salesA, leadId, { workId: workB, evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true })).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_ASSIGNED_RECIPIENT' },
    });

    // Second handoff from A to sales-c while workB is still proposed
    const handedC = await ctrl.handoff(salesA, leadId, {
      context: 'giao thêm cho C',
      proposedAction: 'C kiểm tra lịch',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      recipientUserId: 'sales-c',
    });

    // B STILL has view access because workB is still actionable (was 403 before fix)
    const bView = await ctrl.getLead(salesB, leadId);
    expect(bView.workItems).toHaveLength(2);

    // C cannot accept B's work item
    await expect(ctrl.accept(salesC, leadId, { workId: workB, reason: 'C nhận hộ B' })).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_ASSIGNED_RECIPIENT' },
    });

    // B accepts workB
    const acceptedB = await ctrl.accept(salesB, leadId, { workId: workB, reason: 'B nhận việc của B' });
    expect(acceptedB.owner).toBe('sales-b');
    // C still has view access while handedC.workItemId is proposed
    expect((await ctrl.getLead(salesC, leadId)).lead.id).toBe(leadId);
  });
});

/** P1-3 at the HTTP boundary: superseded items cannot be completed; callers get the live ID. */
describe('P1-3 — reschedule returns the replacement; completing the old ID is 409 + details', () => {
  let ctrl: PilotLoopController;

  beforeEach(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    ctrl = makeController();
  });

  it('reschedule responds with replacementId; complete on the old ID → 409 WORK_SUPERSEDED; complete on the replacement closes the chain', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-p13' });
    const handed = await ctrl.handoff(salesA, res.leadId, {
      context: 'c',
      proposedAction: 'Gọi lại 15:00 thứ Sáu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      recipientUserId: 'sales-b',
      dueAt: '2026-10-09T15:00:00+07:00',
    });
    await ctrl.accept(salesB, res.leadId, { workId: handed.workItemId, reason: 'B nhận' });

    const moved = await ctrl.reschedule(salesB, res.leadId, {
      workId: handed.workItemId,
      newDueAt: '2026-10-12T16:00:00+07:00',
      reason: 'dời sang thứ Hai',
    });
    expect(moved.supersededStatus).toBe('rescheduled');
    expect(typeof moved.replacementId).toBe('string');
    expect(moved.dueAt).toBe('2026-10-12T16:00:00+07:00');
    const replacementId = moved.replacementId as string;

    // completing the OLD id must fail loudly and name the successor
    let caught: unknown;
    await ctrl.complete(salesB, res.leadId, { workId: handed.workItemId, evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true }).catch((e) => (caught = e));
    expect(caught).toMatchObject({ status: 409, response: { code: 'WORK_SUPERSEDED', details: { replacementId } } });

    // and the old item is genuinely still rescheduled (bug was: it flipped to completed)
    const view = await ctrl.getLead(salesB, res.leadId);
    expect(view.workItems.find((w) => w.id === handed.workItemId)?.status).toBe('rescheduled');
    expect(view.workItems.find((w) => w.id === replacementId)?.status).toBe('open');

    // completing the replacement closes the chain with no active item left
    const done = await ctrl.complete(salesB, res.leadId, { workId: replacementId, evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true, reason: 'đã gọi' });
    expect(done.workStatus).toBe('completed');
    const after = await ctrl.getLead(salesB, res.leadId);
    const active = after.workItems.filter((w) => ['proposed', 'accepted', 'open', 'awaiting-external'].includes(w.status as string));
    expect(active).toHaveLength(0);
  });
});

/**
 * P1-4 (HTTP half) + demo-workspace isolation.
 * Two things were possible before: a body value outside the enum reached the store, and the
 * `x-demo-workspace` header let any caller name ANY workspace — i.e. read a real tenant's case
 * by guessing its id. Boundary validation now answers 400 INPUT_INVALID, and demo identity is
 * sandboxed to `demo:<name>` and switch-controlled.
 */
describe('P1-4 + demo isolation at the controller', () => {
  let ctrl: PilotLoopController;

  beforeEach(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    process.env.DEMO_WORKSPACES = 'true';
    ctrl = makeController();
  });

  afterEach(() => {
    delete process.env.DEMO_WORKSPACES;
  });

  it('rejects an evidence value outside the enum with 400 + field issues instead of persisting it', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-v' });
    const handed = await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-commitment', recipientUserId: 'sales-b' });
    await ctrl.accept(salesB, res.leadId, { workId: handed.workItemId, reason: 'nhận' });

    await expect(ctrl.complete(salesB, res.leadId, { workId: handed.workItemId, evidence: 'totally-done' } as never)).rejects.toMatchObject({
      status: 400,
      response: { code: 'INPUT_INVALID', details: { issues: [{ field: 'evidence' }] } },
    });
    // nothing was written: the item is still accepted, not completed
    const view = await ctrl.getLead(salesB, res.leadId);
    expect(view.workItems[0].status).toBe('accepted');
    expect(view.workItems[0].completionEvidence).toBe('absent');
  });

  it('rejects malformed ids and a nonexistent evidence pointer before touching the domain', async () => {
    await expect(ctrl.getLead(salesA, 'not-a-uuid')).rejects.toMatchObject({ status: 400, response: { code: 'INPUT_INVALID' } });

    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-v2' });
    const handed = await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-commitment', recipientUserId: 'sales-b' });
    await ctrl.accept(salesB, res.leadId, { workId: handed.workItemId, reason: 'nhận' });

    // a pointer that does not resolve is refused even though it is syntactically fine
    await expect(ctrl.complete(salesB, res.leadId, { workId: handed.workItemId, evidence: 'observed', evidenceRef: 'made-up-pointer' })).rejects.toMatchObject({
      status: 422,
      response: { code: 'EVIDENCE_NOT_FOUND' },
    });
    expect((await ctrl.getLead(salesB, res.leadId)).workItems[0].status).toBe('accepted');
  });

  it('unauthenticated callers get 401, never a schema description (auth before validation)', async () => {
    await expect(ctrl.intake({}, { displayName: '', utterance: '', speaker: 'alien' } as never)).rejects.toThrow(UnauthorizedException);
  });

  it('demo identity is sandboxed: it cannot address a real workspace by naming it', async () => {
    const real = await ctrl.intake(salesA, { displayName: 'thật', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-real' });
    // demo header pointing at the REAL workspace id — must not reach the real lead
    const demo = { 'x-demo-workspace': 'ws-a' };
    await expect(ctrl.getLead(demo, real.leadId)).rejects.toMatchObject({ status: 404 });

    const d = await ctrl.intake(demo, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-demo-iso' });
    const dv = await ctrl.getLead(demo, d.leadId);
    expect(dv.lead.workspaceId).toBe('demo:ws-a'); // sandbox, never the real tenant id
  });

  it('demo mode is opt-in: without DEMO_WORKSPACES the header grants nothing', async () => {
    delete process.env.DEMO_WORKSPACES;
    await expect(ctrl.intake({ 'x-demo-workspace': 'ws-any' }, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-off' })).rejects.toThrow(UnauthorizedException);
  });
});

describe('GET /pilot/queue — bounded redacted operator projection', () => {
  let ctrl: PilotLoopController;
  beforeEach(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    ctrl = makeController();
  });

  it('filters by actor/status, paginates deterministically, and omits evidence contents', async () => {
    const first = await ctrl.intake(salesA, { displayName: 'first', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'queue-1' });
    const firstWork = await ctrl.handoff(salesA, first.leadId, { context: 'private context', proposedAction: 'call', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'sales-b' });
    const second = await ctrl.intake(salesA, { displayName: 'second', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'queue-2' });
    await ctrl.handoff(salesA, second.leadId, { context: 'other', proposedAction: 'email', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'sales-b' });

    const page = await ctrl.queue(salesB, { status: 'proposed', limit: '1' });
    expect(page.items).toHaveLength(1);
    expect(['first', 'second']).toContain(page.items[0].lead.displayName);
    expect(page.nextCursor).toBeDefined();
    expect(JSON.stringify(page)).not.toContain('evidenceRef');
    expect(JSON.stringify(page)).not.toContain('private context');

    const next = await ctrl.queue(salesB, { status: 'proposed', limit: '1', cursor: page.nextCursor });
    expect(next.items).toHaveLength(1);
    expect(['first', 'second']).toContain(next.items[0].lead.displayName);
  });

  it('keeps cross-workspace and unrelated recipient items out of the queue', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'owned', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'queue-3' });
    await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'call', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'sales-c' });
    await expect(ctrl.queue(salesB, {})).resolves.toEqual({ items: [] });
    await expect(ctrl.queue(foreign, {})).resolves.toEqual({ items: [] });
  });
});
