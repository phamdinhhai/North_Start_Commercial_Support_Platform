import { RbacService } from '../infra/rbac/rbac.service';
import { PilotLoopService } from '../application/pilot/pilot-loop.service';
import { InMemoryPilotStore } from '../infra/pilot/in-memory-pilot.store';
import { ManualAdapter } from '../adapters/manual/manual-adapter';
import { AuditStore } from '../infra/audit/audit-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { FeedbackTelemetryController } from './feedback-telemetry.controller';
import { MAX_FEEDBACK_BODY_CHARS, MAX_FEEDBACK_CONTEXT_BYTES } from './feedback-telemetry.validation';
import { AuthService } from '../infra/auth/auth.service';
import type { AuthContext } from '../ports/auth';

const auth = new AuthService();
const bearer = (payload: Record<string, unknown>) => ({
  authorization: `Bearer ${Buffer.from(JSON.stringify(payload)).toString('base64')}`,
});
const salesHeaders = bearer({ workspaceId: 'ws-a', userId: 'u-a', role: 'sales' });
const viewerHeaders = bearer({ workspaceId: 'ws-a', userId: 'u-view', role: 'viewer' });
const managerCtx: AuthContext = { workspaceId: 'ws-a', userId: 'u-mgr', role: 'manager', isDemo: false };
const adminCtx: AuthContext = { workspaceId: 'ws-a', userId: 'u-adm', role: 'admin', isDemo: false };

function controller(durable = true, resolvedCtx?: AuthContext) {
  const feedback = {
    submit: vi.fn(async (input) => ({
      id: 'fb-1',
      workspaceId: input.workspaceId,
      leadId: input.leadId ?? null,
      actor: input.actor,
      rating: input.rating ?? null,
      body: input.body ?? null,
      context: input.context ?? {},
      createdAt: '2026-01-01T00:00:00.000Z',
    })),
    listByWorkspace: vi.fn(async () => []),
  };
  const telemetry = {
    record: vi.fn(async (input) => ({
      id: 'evt-1',
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      payload: input.payload ?? {},
      releaseVersion: input.releaseVersion ?? '1.0.0',
      flagExposure: input.flagExposure ?? {},
      createdAt: '2026-01-01T00:00:00.000Z',
    })),
    listByWorkspace: vi.fn(async () => []),
  };
  const resolver = resolvedCtx ? { resolve: () => resolvedCtx } : auth;
  const ctrl = new FeedbackTelemetryController(
    resolver,
    feedback,
    telemetry,
    { durable },
    new PilotLoopService(new InMemoryPilotStore(new AuditStore()), new ManualAdapter()),
    new RbacService(),
  );
  return { ctrl, feedback, telemetry };
}

describe('FeedbackTelemetryController', () => {
  beforeEach(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    process.env.DEPLOYMENT_MODE = 'test';
  });

  it('derives workspace and actor from authenticated context and rejects unknown fields', async () => {
    const { ctrl, feedback } = controller();
    await expect(ctrl.submitFeedback(salesHeaders, { rating: 5, body: 'useful', workspaceId: 'ws-evil' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(feedback.submit).not.toHaveBeenCalled();

    const result = await ctrl.submitFeedback(salesHeaders, { rating: 5, body: 'useful' });
    expect(result.workspaceId).toBe('ws-a');
    expect(result.actor).toBe('u-a');
  });

  it('rejects unknown fields on telemetry payloads before service calls', async () => {
    const { ctrl, telemetry } = controller();
    await expect(ctrl.recordTelemetry(salesHeaders, { eventType: 'lead_viewed', workspaceId: 'ws-evil' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(telemetry.record).not.toHaveBeenCalled();
  });

  it('validates leadId UUID and bounds feedback body/context at the boundary', async () => {
    const { ctrl, feedback } = controller();
    await expect(ctrl.submitFeedback(salesHeaders, { leadId: 'not-a-uuid', rating: 5 }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.submitFeedback(salesHeaders, { rating: 9 }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.submitFeedback(salesHeaders, { body: 'x'.repeat(MAX_FEEDBACK_BODY_CHARS + 1) }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.submitFeedback(salesHeaders, { context: { blob: 'x'.repeat(MAX_FEEDBACK_CONTEXT_BYTES) } }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.submitFeedback(salesHeaders, {
      context: { a: { b: { c: { d: { e: { f: { g: 'too-deep' } } } } } } },
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.recordTelemetry(salesHeaders, { eventType: '' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(feedback.submit).not.toHaveBeenCalled();
  });

  it('rejects viewer and demo mutations on feedback and telemetry before validation or storage', async () => {
    const demoContexts: AuthContext[] = [
      { workspaceId: 'demo:sandbox', userId: 'demo-user', role: 'viewer', isDemo: true },
      { workspaceId: 'demo:sandbox', userId: 'demo-sales', role: 'sales', isDemo: true },
      { workspaceId: 'demo:sandbox', userId: 'demo-admin', role: 'admin', isDemo: true },
    ];
    for (const demoCtx of demoContexts) {
      const { ctrl, feedback, telemetry } = controller(false, demoCtx);
      await expect(ctrl.submitFeedback({}, { rating: 5 })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(ctrl.recordTelemetry({}, { eventType: 'lead_viewed' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(feedback.submit).not.toHaveBeenCalled();
      expect(telemetry.record).not.toHaveBeenCalled();
    }

    const { ctrl, feedback, telemetry } = controller(false);
    await expect(ctrl.submitFeedback(viewerHeaders, { rating: 5 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.recordTelemetry(viewerHeaders, { eventType: 'lead_viewed' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(feedback.submit).not.toHaveBeenCalled();
    expect(telemetry.record).not.toHaveBeenCalled();
  });

  it('restricts workspace-wide telemetry read to non-demo admin and manager per ADR-006', async () => {
    const { ctrl, telemetry } = controller();
    await expect(ctrl.listTelemetry(salesHeaders)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.listTelemetry(viewerHeaders)).rejects.toBeInstanceOf(ForbiddenException);
    expect(telemetry.listByWorkspace).not.toHaveBeenCalled();

    const demoAdmin = controller(true, { workspaceId: 'demo:sandbox', userId: 'demo-admin', role: 'admin', isDemo: true });
    await expect(demoAdmin.ctrl.listTelemetry({})).rejects.toBeInstanceOf(ForbiddenException);
    expect(demoAdmin.telemetry.listByWorkspace).not.toHaveBeenCalled();

    const manager = controller(true, managerCtx);
    const admin = controller(true, adminCtx);
    await expect(manager.ctrl.listTelemetry({})).resolves.toEqual({ items: [] });
    await expect(admin.ctrl.listTelemetry({})).resolves.toEqual({ items: [] });
    expect(manager.telemetry.listByWorkspace).toHaveBeenCalledWith('ws-a');
    expect(admin.telemetry.listByWorkspace).toHaveBeenCalledWith('ws-a');
  });

  it('requires authentication', async () => {
    const { ctrl } = controller();
    await expect(ctrl.listFeedback({})).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(ctrl.listTelemetry({})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails clearly when durable storage is unavailable', async () => {
    await expect(controller(false, managerCtx).ctrl.listTelemetry({})).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('lists only the authenticated workspace through service ports', async () => {
    const { ctrl } = controller();
    const admin = controller(true, adminCtx);
    await expect(ctrl.listFeedback(salesHeaders)).resolves.toEqual({ items: [] });
    await expect(admin.ctrl.listTelemetry({})).resolves.toEqual({ items: [] });
  });
});
