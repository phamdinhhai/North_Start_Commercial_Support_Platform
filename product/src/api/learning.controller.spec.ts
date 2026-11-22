import { describe, expect, it, vi } from 'vitest';
import { LearningController } from './learning.controller';
import { PilotLoopService } from '../application/pilot/pilot-loop.service';
import { ManualAdapter } from '../adapters/manual/manual-adapter';
import { InMemoryPilotStore } from '../infra/pilot/in-memory-pilot.store';
import { AuditStore } from '../infra/audit/audit-store';
import { RbacService } from '../infra/rbac/rbac.service';
import type { AuthContext } from '../ports/auth';

async function fixture(isSynthetic: boolean, durable = true) {
  const ctx: AuthContext = { workspaceId: 'ws-learning', userId: 'owner', role: 'sales', isDemo: false };
  const loop = new PilotLoopService(new InMemoryPilotStore(new AuditStore()), new ManualAdapter());
  const lead = await loop.ingestScenario({ workspaceId: ctx.workspaceId, ownerUserId: ctx.userId, displayName: 'Synthetic-only fixture',
    utterance: 'Only invented review text', speaker: 'customer', connection: 'manual', externalRecordId: 'learning-fixture', isSynthetic });
  const recorder = { recordLearning: vi.fn().mockResolvedValue({}) };
  const auth = { resolve: () => ctx as AuthContext | null };
  return { ctx, lead, recorder, auth, controller: new LearningController(auth, new RbacService(), loop, recorder, { durable }) };
}
describe('R4 privacy-safe learning boundary', () => {
  it.each(['handoff_started', 'contact_attempt_recorded', 'workflow_error', 'workflow_recovered'])(
    'keeps %s categorical and excludes synthetic observations', async eventType => {
      const synthetic = await fixture(true);
      expect(await synthetic.controller.record({}, { leadId: synthetic.lead.lead.id, eventType })).toMatchObject({ recorded: false });
      expect(synthetic.recorder.recordLearning).not.toHaveBeenCalled();
      const classified = await fixture(false);
      expect(await classified.controller.record({}, { leadId: classified.lead.lead.id, eventType })).toMatchObject({ recorded: true });
      expect(classified.recorder.recordLearning).toHaveBeenCalledWith(expect.objectContaining({ eventType, payload: { safe: 'ok' } }));
      await expect(classified.controller.record({}, { leadId: classified.lead.lead.id, eventType, error: 'private details' })).rejects.toMatchObject({ status: 400 });
    });
  it('records only categorical scoped metadata, never lead/customer IDs or message content', async () => {
    const f = await fixture(false);
    expect(await f.controller.record({}, { leadId: f.lead.lead.id, eventType: 'evidence_viewed', releaseVersion: '0.1.0' })).toMatchObject({ recorded: true });
    expect(f.recorder.recordLearning).toHaveBeenCalledWith({ workspaceId: 'ws-learning', eventType: 'evidence_viewed',
      releaseVersion: '0.1.0', flagExposure: { pancake_sync: 'off' }, payload: { safe: 'ok' } });
    expect(JSON.stringify(f.recorder.recordLearning.mock.calls)).not.toContain(f.lead.lead.id);
  });
  it('excludes synthetic regardless of client intent and rejects raw/extra fields', async () => {
    const f = await fixture(true);
    expect(await f.controller.record({}, { leadId: f.lead.lead.id, eventType: 'lead_opened' })).toMatchObject({ recorded: false });
    expect(f.recorder.recordLearning).not.toHaveBeenCalled();
    await expect(f.controller.record({}, { leadId: f.lead.lead.id, eventType: 'lead_opened', isSynthetic: false })).rejects.toMatchObject({ status: 400 });
    await expect(f.controller.record({}, { leadId: f.lead.lead.id, eventType: 'lead_opened', message: 'forbidden content' })).rejects.toMatchObject({ status: 400 });
  });
  it('denies unauthenticated, unrelated, cross-workspace and unknown-lead reports', async () => {
    const f = await fixture(false), body = { leadId: f.lead.lead.id, eventType: 'lead_opened' };
    f.ctx.userId = 'bystander';
    await expect(f.controller.record({}, body)).rejects.toMatchObject({ status: 403 });
    f.ctx.workspaceId = 'foreign';
    await expect(f.controller.record({}, body)).rejects.toMatchObject({ status: 404 });
    f.auth.resolve = () => null;
    await expect(f.controller.record({}, body)).rejects.toMatchObject({ status: 401 });
    expect(f.recorder.recordLearning).not.toHaveBeenCalled();
  });
  it('does not report persistence success in memory mode; rejects invented events', async () => {
    const f = await fixture(false, false);
    await expect(f.controller.record({}, { leadId: f.lead.lead.id, eventType: 'action_created' })).rejects.toMatchObject({ status: 503 });
    await expect(f.controller.record({}, { leadId: f.lead.lead.id, eventType: 'revenue_confirmed' })).rejects.toMatchObject({ status: 400 });
  });
});
