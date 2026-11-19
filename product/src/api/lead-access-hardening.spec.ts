import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { FeedbackTelemetryController } from './feedback-telemetry.controller';
import { PilotLoopController } from './pilot-loop.controller';
import { PilotLoopService } from '../application/pilot/pilot-loop.service';
import { InMemoryPilotStore } from '../infra/pilot/in-memory-pilot.store';
import { AuditStore } from '../infra/audit/audit-store';
import { RbacService } from '../infra/rbac/rbac.service';
import { ManualAdapter } from '../adapters/manual/manual-adapter';
import type { AuthContext } from '../ports/auth';
import type { Feedback } from '../ports/feedback';

const ctx: AuthContext = { workspaceId: 'access-tests', userId: 'reader', role: 'sales', isDemo: false };
const input = { displayName: 'Case', utterance: 'Please call', speaker: 'customer' as const, connection: 'manual', externalRecordId: 'one' };
function setup() {
  const store = new InMemoryPilotStore(new AuditStore());
  const loop = new PilotLoopService(store, new ManualAdapter());
  const policy = new RbacService();
  const auth = { resolve: () => ctx };
  const feedback = { submit: vi.fn(async () => ({} as Feedback)), listByWorkspace: vi.fn(async () => [] as Feedback[]) };
  const telemetry = { record: vi.fn(), listByWorkspace: vi.fn() };
  const controller = new FeedbackTelemetryController(auth, feedback, telemetry, { durable: true }, loop, policy);
  return { store, loop, feedback, controller, intake: new PilotLoopController(auth, policy, loop) };
}
const feedbackRow = (actor: string, leadId: string | null = null): Feedback => ({
  id: randomUUID(), workspaceId: ctx.workspaceId, actor, leadId, rating: null, body: 'note', context: {}, createdAt: '2026-01-01T00:00:00Z',
});

describe('I-09 feedback and replay boundaries', () => {
  it('hides unassigned lead feedback even when authored by the caller; keeps own unlinked feedback', async () => {
    const s = setup();
    const lead = await s.loop.ingestScenario({ ...input, workspaceId: ctx.workspaceId, ownerUserId: 'other' });
    const own = feedbackRow(ctx.userId);
    s.feedback.listByWorkspace.mockResolvedValue([own, feedbackRow('other'), feedbackRow(ctx.userId, lead.lead.id)]);
    expect((await s.controller.listFeedback({})).items).toEqual([own]);
    await expect(s.controller.submitFeedback({}, { leadId: lead.lead.id, rating: 5 })).rejects.toMatchObject({ status: 403 });
    expect(s.feedback.submit).not.toHaveBeenCalled();
  });

  it('allows current owner and active recipient; revokes historical recipients', async () => {
    const s = setup();
    const lead = await s.loop.ingestScenario({ ...input, workspaceId: ctx.workspaceId, ownerUserId: ctx.userId });
    const linked = feedbackRow('other', lead.lead.id);
    s.feedback.listByWorkspace.mockResolvedValue([linked]);
    expect((await s.controller.listFeedback({})).items).toEqual([linked]);
    await s.controller.submitFeedback({}, { leadId: lead.lead.id, rating: 5 });
    expect(s.feedback.submit).toHaveBeenCalledOnce();
    const work = { id: randomUUID(), leadId: lead.lead.id, workspaceId: ctx.workspaceId, action: 'call', responsibleParty: 'internal' as const,
      origin: 'explicit-request' as const, status: 'proposed' as const, completionEvidence: 'absent' as const, occurredAt: 'unknown', recordedAt: new Date().toISOString(), actor: ctx.userId };
    const assigned = await s.store.save({ ...lead, ownerUserId: 'other', workItems: [work] }, []);
    expect((await s.controller.listFeedback({})).items).toEqual([linked]);
    await s.store.save({ ...assigned, workItems: [{ ...work, status: 'cancelled' }] }, []);
    expect((await s.controller.listFeedback({})).items).toEqual([]);
  });

  it('keeps existing manager/admin workspace authority for unlinked and assigned feedback', async () => {
    const s = setup();
    const other = await s.loop.ingestScenario({ ...input, workspaceId: ctx.workspaceId, ownerUserId: 'other' });
    const items = [feedbackRow('other'), feedbackRow('other', other.lead.id)];
    s.feedback.listByWorkspace.mockResolvedValue(items);
    for (const role of ['manager', 'admin'] as const) {
      const controller = new FeedbackTelemetryController({ resolve: () => ({ ...ctx, role }) }, s.feedback,
        { record: vi.fn(), listByWorkspace: vi.fn() }, { durable: true }, s.loop, new RbacService());
      expect((await controller.listFeedback({})).items).toEqual(items);
    }
  });

  it('makes missing/cross-workspace lead invisible and never submits feedback', async () => {
    const s = setup();
    const lead = await s.loop.ingestScenario({ ...input, workspaceId: 'foreign', ownerUserId: ctx.userId });
    s.feedback.listByWorkspace.mockResolvedValue([feedbackRow('reader', lead.lead.id), { ...feedbackRow('reader'), workspaceId: 'foreign' }]);
    expect((await s.controller.listFeedback({})).items).toEqual([]);
    for (const leadId of [lead.lead.id, randomUUID()]) {
      await expect(s.controller.submitFeedback({}, { leadId, rating: 5 })).rejects.toMatchObject({ status: 404 });
    }
    expect(s.feedback.submit).not.toHaveBeenCalled();
  });

  it('refuses same-workspace replay before returning lead identity or idempotency details without mutations', async () => {
    const s = setup();
    const lead = await s.loop.ingestScenario({ ...input, workspaceId: ctx.workspaceId, ownerUserId: 'other' });
    const before = await s.store.history(lead.lead.id);
    for (const utterance of [input.utterance, 'different payload']) {
      await expect(s.intake.intake({}, { ...input, utterance })).rejects.toMatchObject({ status: 403 });
    }
    expect(await s.store.load(lead.lead.id)).toEqual(lead);
    expect(await s.store.history(lead.lead.id)).toEqual(before);
  });
});
