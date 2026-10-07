import { beforeEach, describe, expect, it } from 'vitest';
import { AuditStore } from '../../infra/audit/audit-store';
import { InMemoryPilotStore } from './pilot.store';
import { PilotLoopService } from './pilot-loop.service';
import type { ScenarioInput } from './pilot.types';

/**
 * P1-4 — an evidence pointer is a REFERENCE to immutable raw evidence (I-12), not a way to
 * promote a statement. Before the fix `observed` accepted any string as `evidenceRef`: a
 * fabricated, foreign or unrelated pointer closed work and left an unverifiable trail.
 *
 * Rules enforced here (all inside the frozen I-09/I-12 boundary, no new entities):
 *  - the pointer must resolve to evidence in the SAME workspace (else 422/403 refusal);
 *  - the evidence must relate to THIS lead (source envelope, the referenced handoff, or an
 *    envelope already cited by that handoff) — else 422 EVIDENCE_NOT_RELATED;
 *  - a valid pointer on `declared` does not upgrade the record to `observed`;
 *  - pointer presence never changes outcome assertionStatus (claimed stays claimed).
 */
const base: ScenarioInput = {
  workspaceId: 'ws-p14',
  displayName: 'Phụ huynh A',
  utterance: 'Chị gửi em bảng học phí nhé.',
  speaker: 'customer',
  connection: 'manual-paste',
  externalRecordId: 'msg-p14',
  isSynthetic: true,
  ownerUserId: 'marketing-lan',
};

function make() {
  const store = new InMemoryPilotStore(new AuditStore());
  return { svc: new PilotLoopService(store), other: new PilotLoopService(store) };
}

async function openWork(svc: PilotLoopService, workspaceId = base.workspaceId, externalRecordId = base.externalRecordId) {
  const state = await svc.ingestScenario({ ...base, workspaceId, externalRecordId });
  const handed = await svc.handoffToSales(state.lead.id, {
    context: 'c',
    proposedAction: 'Gửi bảng học phí',
    responsibleParty: 'internal',
    origin: 'explicit-commitment',
    actor: 'marketing-lan',
    recipientUserId: 'marketing-lan',
  });
  const workId = handed.workItems[0].id;
  await svc.salesAccept(state.lead.id, { workId, actor: 'marketing-lan', reason: 'nhận' });
  return { state, workId, envelopeId: state.sourceEnvelopeId! };
}

describe('P1-4 — evidence must exist, be in workspace scope and relate to the action', () => {
  let svc: PilotLoopService;
  let other: PilotLoopService;

  beforeEach(() => {
    ({ svc, other } = make());
  });

  it('rejects a pointer that does not exist (EVIDENCE_NOT_FOUND) and leaves work open', async () => {
    const { state, workId } = await openWork(svc);
    await expect(
      svc.completeWork(state.lead.id, { workId, actor: 'marketing-lan', evidence: 'observed', evidenceRef: 'no-such-envelope' }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_NOT_FOUND', status: 422 });

    const after = (await svc.get(state.lead.id))!.workItems.find((w) => w.id === workId)!;
    expect(after.status).toBe('accepted');
    expect(after.completionEvidence).toBe('absent');
  });

  it("rejects a pointer into another workspace's envelope (EVIDENCE_OUT_OF_SCOPE)", async () => {
    const { state, workId } = await openWork(svc);
    const foreign = await other.ingestScenario({ ...base, workspaceId: 'ws-other-tenant', externalRecordId: 'msg-other' });

    await expect(
      svc.completeWork(state.lead.id, { workId, actor: 'marketing-lan', evidence: 'observed', evidenceRef: foreign.sourceEnvelopeId! }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_OUT_OF_SCOPE', status: 403 });
    expect((await svc.get(state.lead.id))!.workItems.find((w) => w.id === workId)!.status).toBe('accepted');
  });

  it('rejects an in-workspace pointer from a different case (EVIDENCE_NOT_RELATED)', async () => {
    const { state, workId } = await openWork(svc);
    const unrelated = await other.ingestScenario({ ...base, externalRecordId: 'msg-unrelated' });

    await expect(
      svc.completeWork(state.lead.id, { workId, actor: 'marketing-lan', evidence: 'observed', evidenceRef: unrelated.sourceEnvelopeId! }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_NOT_RELATED', status: 422 });
  });

  it('accepts the lead’s own evidence, records the raw hash in the audit, and promotes nothing else', async () => {
    const { state, workId, envelopeId } = await openWork(svc);
    const env = (await svc.get(state.lead.id))!.envelope!;

    const done = await svc.completeWork(state.lead.id, {
      workId,
      actor: 'marketing-lan',
      evidence: 'observed',
      evidenceRef: envelopeId,
      occurredAt: '2026-10-09T15:05:00+07:00',
      reason: 'tin nhắn gửi file đã được ghi nhận',
    });
    const w = done.workItems.find((x) => x.id === workId)!;
    expect(w.completionEvidence).toBe('observed');
    expect(w.evidenceRef).toBe(envelopeId);

    // audit is traceable to immutable raw evidence (I-12) — hash, not the pointer string alone
    const history = await svc.auditHistory(state.lead.id);
    const entry = history.find((h) => h.eventType === 'work_completed');
    expect(entry?.newValue).toContain(env.rawPayloadHash);

    // a valid observed pointer does NOT make the later outcome any more verified than a claim
    await svc.advance(state.lead.id, { to: 'Contacting', actor: 'marketing-lan', reason: 'đã gửi' });
    await svc.advance(state.lead.id, { to: 'Follow-up', actor: 'marketing-lan', reason: 'chờ' });
    const won = await svc.recordOutcome(state.lead.id, { value: 'Won', actor: 'marketing-lan', reason: 'báo đã deposit' });
    expect(won.outcomes[0].assertionStatus).toBe('claimed');
  });

  it('a pointer supplied with `declared` does not upgrade the record to observed', async () => {
    const { state, workId, envelopeId } = await openWork(svc);
    const done = await svc.completeWork(state.lead.id, {
      workId,
      actor: 'marketing-lan',
      evidence: 'declared',
      evidenceRef: envelopeId,
      reason: 'nhân viên báo đã gửi',
    });
    const w = done.workItems.find((x) => x.id === workId)!;
    expect(w.completionEvidence).toBe('declared');
    expect(w.evidenceRef).toBe(envelopeId);
  });

  it('handoff evidenceRef must resolve — no fabricated "pending" hash (I-12)', async () => {
    const state = await svc.ingestScenario({ ...base, externalRecordId: 'msg-ho' });
    await expect(
      svc.handoffToSales(state.lead.id, {
        context: 'c',
        proposedAction: 'a',
        responsibleParty: 'internal',
        origin: 'explicit-request',
        actor: 'marketing-lan',
        recipientUserId: 'sales-b',
        evidenceRef: 'envelope-fabricated',
      }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_NOT_FOUND', status: 422 });

    const ok = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'a',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-b',
      evidenceRef: state.sourceEnvelopeId!,
    });
    expect(ok.handoff!.evidenceRefs[0].rawPayloadHash).not.toBe('pending');
    expect(ok.handoff!.evidenceRefs[0].rawPayloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('UNKNOWN_SENTINEL is not an evidence pointer', async () => {
    const { state, workId } = await openWork(svc);
    await expect(
      svc.completeWork(state.lead.id, { workId, actor: 'marketing-lan', evidence: 'observed', evidenceRef: 'unknown' }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_NOT_FOUND', status: 422 });
  });
});
