import { beforeEach, describe, expect, it } from 'vitest';
import { UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PilotLoopController } from './pilot-loop.controller';
import { AuthService } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { PilotLoopService } from '../modules/pilot-loop/pilot-loop.service';
import { InMemoryPilotStore } from '../modules/pilot-loop/pilot.store';
import { AuditStore } from '../infra/audit/audit-store';
import { ManualAdapter } from '../adapters/manual/manual-adapter';

const demoHeaders = { 'x-demo-workspace': 'ws-demo' };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64');
const salesA = { authorization: `Bearer ${b64({ workspaceId: 'ws-a', userId: 'marketing-a', role: 'sales' })}` };
const salesB = { authorization: `Bearer ${b64({ workspaceId: 'ws-a', userId: 'sales-b', role: 'sales' })}` };
const salesC = { authorization: `Bearer ${b64({ workspaceId: 'ws-a', userId: 'sales-c', role: 'sales' })}` };
const foreign = { authorization: `Bearer ${b64({ workspaceId: 'ws-b', userId: 'sales-9', role: 'sales' })}` };

function makeController(): PilotLoopController {
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
    expect(view.lead.workspaceId).toBe('ws-demo');
  });

  it('runs the loop end-to-end over the controller surface', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'Phụ huynh B', utterance: 'Gửi chị học phí nhé', speaker: 'customer', connection: 'manual', externalRecordId: 'msg-2' });
    const handed = await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'Gửi bảng học phí', responsibleParty: 'internal', origin: 'explicit-commitment', recipientUserId: 'sales-b' });
    await ctrl.accept(salesB, res.leadId, { workId: handed.workItemId, reason: 'B nhận' });
    const done = await ctrl.complete(salesB, res.leadId, { workId: handed.workItemId, evidence: 'declared', reason: 'đã gửi qua Zalo' });
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
  });

  it('guardrail refusals map to 4xx business codes, not raw 500', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'em gửi rồi nhé', speaker: 'staff', connection: 'c', externalRecordId: 'r' });
    const handed = await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-commitment', recipientUserId: 'sales-b' });
    await expect(ctrl.complete(salesA, res.leadId, { workId: handed.workItemId, evidence: 'observed' })).rejects.toMatchObject({
      status: 422,
      response: { code: 'EVIDENCE_POINTER_REQUIRED' },
    });
    // New→Contacting nằm ngoài hypothesis CE-1 → PilotDomainError 422 CE1_BOUNDARY, controller map thành HttpException
    await expect(ctrl.advance(salesA, res.leadId, { to: 'Contacting', reason: 'x' })).rejects.toMatchObject({
      status: 422,
      response: { code: 'CE1_BOUNDARY' },
    });
  });

  it('external expectation → unobserved endpoint returns awaiting-external, never failure', async () => {
    const res = await ctrl.intake(salesA, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r-ext' });
    const handed = await ctrl.handoff(salesA, res.leadId, { context: 'c', proposedAction: 'Chị A trao đổi với bé', responsibleParty: 'external', origin: 'explicit-request', recipientUserId: 'sales-b' });
    const marked = await ctrl.unobserved(salesA, res.leadId, { workId: handed.workItemId });
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
    await expect(ctrl.complete(salesB, leadId, { workId: workItemId, evidence: 'declared' })).rejects.toMatchObject({
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
    const done = await ctrl.complete(salesB, leadId, { workId: workItemId, evidence: 'declared', reason: 'đã gọi' });
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
});
