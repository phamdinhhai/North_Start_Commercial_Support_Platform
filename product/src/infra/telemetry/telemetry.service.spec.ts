import { describe, expect, it } from 'vitest';
import { redactTelemetryPayload, TelemetryService } from './telemetry.service';
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
    expect(calls[0].params?.[2]).toBe('{"_redacted_key":"[REDACTED]"}');
  });

  it('redacts sensitive keys recursively before persistence', () => {
    expect(redactTelemetryPayload({ token: 'secret', nested: { email: 'a@example.com', safe: 'ok' } })).toEqual({
      _redacted_key: '[REDACTED]',
      nested: { _redacted_key: '[REDACTED]', safe: 'ok' },
    });
  });

  it('bounds oversized serialized payloads', () => {
    expect(redactTelemetryPayload({ nested: Array.from({ length: 30 }, () => 'ok') }, 64)).toEqual({
      _truncated: true,
      _reason: 'payload_size_limit',
    });
  });

  it('does not persist PII or secrets in any INSERT parameter, including innocent-looking payload values', async () => {
    const parameters: unknown[][] = [];
    const db = { query: async (_text: string, params: unknown[]) => {
      parameters.push(params);
      return { rows: [{
        id: 'evt', workspace_id: params[0], event_type: params[1], payload: JSON.parse(params[2] as string),
        release_version: params[3], flag_exposure: JSON.parse(params[4] as string), created_at: new Date(),
      }] };
    } } as unknown as PostgresService;
    const result = await new TelemetryService(db).record({
      workspaceId: 'ws-1', eventType: 'lead_viewed', releaseVersion: '1.2.3',
      flagExposure: { pancake_sync: 'off' },
      payload: {
        leadId: 'alice@example.com', details: 'Bearer topsecret',
        nested: { safe: 'https://example.com/?token=topsecret', email: 'alice@example.com' },
        'alice@example.com': 'exfil',
      },
    });
    expect(parameters).toHaveLength(1);
    expect(parameters[0]).toHaveLength(5);
    const serialized = JSON.stringify(parameters[0]);
    for (const secret of ['alice@example.com', 'topsecret', 'Bearer', 'https://', 'exfil']) {
      expect(serialized).not.toContain(secret);
    }
    expect(result.payload).toMatchObject({ _redacted_key: '[REDACTED]', details: '[REDACTED]' });
    expect(result.payload).toHaveProperty('_redacted_key', '[REDACTED]');
    expect(() => redactTelemetryPayload({ safe: 'ok' }, 100_000)).toThrow('maxBytes');
  });

  it('rejects unapproved or oversized identifiers and flags before querying the database', async () => {
    let calls = 0;
    const svc = new TelemetryService({ query: async () => { calls++; return { rows: [] }; } } as unknown as PostgresService);
    const valid = { workspaceId: 'ws-1', eventType: 'lead_viewed' };
    const invalid: Array<Parameters<TelemetryService['record']>[0]> = [
      { ...valid, workspaceId: 'alice@example.com' },
      { ...valid, workspaceId: 'ws-' + 'a'.repeat(100) },
      { ...valid, eventType: 'alice@example.com' },
      { ...valid, eventType: 'lead_viewed;Bearer abc' },
      { ...valid, releaseVersion: '1.2.3+alice@example.com' },
      { ...valid, releaseVersion: '1.2.3-' + 'x'.repeat(100) },
      { ...valid, flagExposure: { pancake_sync: 'Bearer topsecret' } },
      { ...valid, flagExposure: { 'alice@example.com': 'off' } },
      { ...valid, flagExposure: { unknown_flag: 'off' } },
    ];
    for (const entry of invalid) {
      await expect(svc.record(entry)).rejects.toThrow();
    }
    expect(calls).toBe(0);
  });

  it('redacts deep, cyclic and large structures without persisting unsafe values or invoking getters', () => {
    const cyclic: Record<string, unknown> = { nested: {} };
    cyclic.nested = cyclic;
    expect(redactTelemetryPayload(cyclic)).toMatchObject({ _truncated: true });
    expect(redactTelemetryPayload({ nested: Array.from({ length: 65 }, () => 'ok') })).toMatchObject({ _truncated: true });
    expect(redactTelemetryPayload({ details: 123456789, safe: 'alice@example.com' })).toEqual({
      details: '[REDACTED]', safe: '[REDACTED]',
    });
    const withGetter = Object.defineProperty({}, 'details', { enumerable: true, get: () => { throw Error('getter invoked'); } });
    expect(redactTelemetryPayload(withGetter)).toEqual({ details: '[REDACTED]' });
  });

  it('requires workspace and event type', async () => {
    const svc = new TelemetryService({ query: async () => ({ rows: [] }) } as unknown as PostgresService);
    await expect(svc.record({ workspaceId: '', eventType: 'x' })).rejects.toThrow('workspaceId');
    await expect(svc.record({ workspaceId: 'ws-1', eventType: '' })).rejects.toThrow('eventType');
  });
});
