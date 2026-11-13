import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { FeedbackTelemetryController } from './feedback-telemetry.controller';
import { AuthService } from '../infra/auth/auth.service';

const auth = new AuthService();
const headers = { authorization: `Bearer ${Buffer.from(JSON.stringify({ workspaceId: 'ws-a', userId: 'u-a', role: 'sales' })).toString('base64')}` };

function controller(durable = true) {
  return new FeedbackTelemetryController(
    auth,
    { submit: vi.fn(async (input) => ({ id: 'fb-1', workspaceId: input.workspaceId, leadId: null, actor: input.actor, rating: input.rating ?? null, body: input.body ?? null, context: input.context ?? {}, createdAt: '2026-01-01T00:00:00.000Z' })), listByWorkspace: vi.fn(async () => []) },
    { record: vi.fn(async (input) => ({ id: 'evt-1', workspaceId: input.workspaceId, eventType: input.eventType, payload: input.payload ?? {}, releaseVersion: input.releaseVersion ?? '1.0.0', flagExposure: input.flagExposure ?? {}, createdAt: '2026-01-01T00:00:00.000Z' })), listByWorkspace: vi.fn(async () => []) },
    { durable },
  );
}

describe('FeedbackTelemetryController', () => {
  beforeEach(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    process.env.DEPLOYMENT_MODE = 'test';
  });
  it('derives workspace and actor from authenticated context', async () => {
    const ctrl = controller();
    const result = await ctrl.submitFeedback(headers, { rating: 5, body: 'useful', workspaceId: 'ws-evil' });
    expect(result.workspaceId).toBe('ws-a');
    expect(result.actor).toBe('u-a');
  });

  it('validates boundary bodies before service calls', async () => {
    const ctrl = controller();
    await expect(ctrl.submitFeedback(headers, { rating: 9 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.recordTelemetry(headers, { eventType: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires authentication', async () => {
    await expect(controller().listFeedback({})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails clearly when durable storage is unavailable', async () => {
    await expect(controller(false).listTelemetry(headers)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('lists only the authenticated workspace through service ports', async () => {
    const ctrl = controller();
    await expect(ctrl.listFeedback(headers)).resolves.toEqual({ items: [] });
    await expect(ctrl.listTelemetry(headers)).resolves.toEqual({ items: [] });
  });
});
