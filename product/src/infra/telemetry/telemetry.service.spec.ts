import { describe, expect, it } from 'vitest';
import { TelemetryService } from './telemetry.service';
import type { PostgresService } from '../postgres/postgres.service';

describe('TelemetryService — PH3 T3-06 (R-21/R-22)', () => {
  it('tags product events with release version and flag exposure', async () => {
    const calls: Array<{ text: string; params?: unknown[] }> = [];
    const db = {
      query: async (text: string, params?: unknown[]) => {
        calls.push({ text, params });
        return {
          rows: [{
            id: 'evt-1',
            workspace_id: 'ws-1',
            event_type: 'lead_viewed',
            payload: { leadId: 'lead-1' },
            release_version: '1.2.3',
            flag_exposure: { pancake_sync: 'off' },
            created_at: '2026-10-03T00:00:00.000Z',
          }],
        };
      },
    } as unknown as PostgresService;

    const event = await new TelemetryService(db).record({
      workspaceId: 'ws-1',
      eventType: 'lead_viewed',
      payload: { leadId: 'lead-1' },
      releaseVersion: '1.2.3',
      flagExposure: { pancake_sync: 'off' },
    });

    expect(event.releaseVersion).toBe('1.2.3');
    expect(event.flagExposure).toEqual({ pancake_sync: 'off' });
    expect(calls[0].text).toContain('INSERT INTO product_event');
    expect(calls[0].text).not.toContain('feedback');
  });

  it('requires workspace and event type', async () => {
    const svc = new TelemetryService({ query: async () => ({ rows: [] }) } as unknown as PostgresService);
    await expect(svc.record({ workspaceId: '', eventType: 'x' })).rejects.toThrow('workspaceId');
    await expect(svc.record({ workspaceId: 'ws', eventType: '' })).rejects.toThrow('eventType');
  });
});
