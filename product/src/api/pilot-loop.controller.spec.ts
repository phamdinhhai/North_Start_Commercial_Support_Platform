import { beforeEach, describe, expect, it } from 'vitest';
import { UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PilotLoopController } from './pilot-loop.controller';
import { AuthService } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { PilotLoopService } from '../modules/pilot-loop/pilot-loop.service';

const demoHeaders = { 'x-demo-workspace': 'ws-demo' };
const userHeaders = { authorization: `Bearer ${Buffer.from(JSON.stringify({ workspaceId: 'ws-a', userId: 'sales-1', role: 'sales' })).toString('base64')}` };
const otherUserHeaders = { authorization: `Bearer ${Buffer.from(JSON.stringify({ workspaceId: 'ws-a', userId: 'sales-2', role: 'sales' })).toString('base64')}` };
const foreignWsHeaders = { authorization: `Bearer ${Buffer.from(JSON.stringify({ workspaceId: 'ws-b', userId: 'sales-9', role: 'sales' })).toString('base64')}` };

function makeController(): PilotLoopController {
  return new PilotLoopController(new AuthService(), new RbacService(), new PilotLoopService());
}

describe('PilotLoopController — auth & RBAC (T3-03/T3-04 wiring)', () => {
  let ctrl: PilotLoopController;

  beforeEach(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    ctrl = makeController();
  });

  it('rejects unauthenticated non-demo request with 401 (R-02)', () => {
    expect(() => ctrl.intake({}, { displayName: 'x', utterance: 'y', speaker: 'customer', connection: 'c', externalRecordId: 'r' })).toThrow(UnauthorizedException);
  });

  it('does not read workspaceId from body — server-derived auth context wins (QA-32)', () => {
    const res = ctrl.intake(userHeaders, {
      displayName: 'Phụ huynh A',
      utterance: 'Thứ Sáu em gọi lại cho chị nhé',
      speaker: 'customer',
      connection: 'manual',
      externalRecordId: 'msg-1',
      workspaceId: 'ws-EVIL', // body attempts to pick workspace
    } as never);
    const view = ctrl.getLead(userHeaders, res.leadId);
    expect(view.lead.workspaceId).toBe('ws-a');
  });

  it('cross-workspace access is invisible — 404, not 403 (AC-03, I-09)', () => {
    const res = ctrl.intake(userHeaders, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r' });
    expect(() => ctrl.getLead(foreignWsHeaders, res.leadId)).toThrow(NotFoundException);
  });

  it('unassigned sales in same workspace gets 403 on accepted lead of another sales (I-09)', () => {
    const res = ctrl.intake(userHeaders, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r' });
    const handed = ctrl.handoff(userHeaders, res.leadId, { context: 'c', proposedAction: 'Gọi lại', responsibleParty: 'internal', origin: 'explicit-request' });
    ctrl.accept(userHeaders, res.leadId, { workId: handed.workItemId, reason: 'Sales 1 nhận' });
    expect(() => ctrl.getLead(otherUserHeaders, res.leadId)).toThrow(ForbiddenException);
    // owner vẫn xem được
    expect(ctrl.getLead(userHeaders, res.leadId).lead.id).toBe(res.leadId);
  });

  it('demo workspace passes without token (R-02 AC)', () => {
    const res = ctrl.intake(demoHeaders, { displayName: 'd', utterance: 'u', speaker: 'customer', connection: 'c', externalRecordId: 'r' });
    expect(res.status).toBe('New');
    const view = ctrl.getLead(demoHeaders, res.leadId);
    expect(view.lead.workspaceId).toBe('ws-demo');
  });

  it('runs the loop end-to-end over the HTTP surface', () => {
    const res = ctrl.intake(userHeaders, { displayName: 'Phụ huynh B', utterance: 'Gửi chị học phí nhé', speaker: 'customer', connection: 'manual', externalRecordId: 'msg-2' });
    const handed = ctrl.handoff(userHeaders, res.leadId, { context: 'c', proposedAction: 'Gửi bảng học phí', responsibleParty: 'internal', origin: 'explicit-commitment' });
    ctrl.accept(userHeaders, res.leadId, { workId: handed.workItemId, reason: 'Sales nhận' });
    expect(handed.leadStatus).toBe('New');
    const done = ctrl.complete(userHeaders, res.leadId, { workId: handed.workItemId, evidence: 'declared', reason: 'đã gửi qua Zalo' });
    expect(done.workStatus).toBe('completed');
    expect(done.evidence).toBe('declared');
    expect(done.occurredAt).toBe('unknown'); // Q4: không backfill occurredAt
    const adv1 = ctrl.advance(userHeaders, res.leadId, { to: 'Contacting', reason: 'đã gọi' });
    expect(adv1.leadStatus).toBe('Contacting');
    const adv2 = ctrl.advance(userHeaders, res.leadId, { to: 'Follow-up', reason: 'chờ phản hồi' });
    expect(adv2.leadStatus).toBe('Follow-up');
    const out = ctrl.outcome(userHeaders, res.leadId, { value: 'Won', reason: 'đã deposit' });
    expect(out.leadStatus).toBe('Won');
    expect(out.assertionStatus).toBe('claimed'); // R-15: claim, không tự verified
  });

  it('observed completion without evidence pointer fails closed (Q3)', () => {
    const res = ctrl.intake(userHeaders, { displayName: 'd', utterance: 'em gửi rồi nhé', speaker: 'staff', connection: 'c', externalRecordId: 'r' });
    const handed = ctrl.handoff(userHeaders, res.leadId, { context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-commitment' });
    expect(() => ctrl.complete(userHeaders, res.leadId, { workId: handed.workItemId, evidence: 'observed' })).toThrow(/system evidence pointer/);
  });
});
