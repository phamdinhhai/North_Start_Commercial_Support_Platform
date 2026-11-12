import { describe, expect, it } from 'vitest';
import { FeedbackService } from './feedback.service';
import type { PostgresService } from '../postgres/postgres.service';

function fakeDb(row: Record<string, unknown> = {}) {
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  const db = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return {
        rows: [{
          id: 'fb-1',
          workspace_id: 'ws-1',
          lead_id: 'lead-1',
          actor: 'sales-1',
          rating: 4,
          body: 'useful',
          context: { action: 'handoff' },
          created_at: '2026-10-03T00:00:00.000Z',
          ...row,
        }],
      };
    },
  } as unknown as PostgresService;
  return { db, calls };
}

describe('FeedbackService — PH3 T3-07 (R-23)', () => {
  it('stores structured feedback separately from telemetry', async () => {
    const { db, calls } = fakeDb();
    const feedback = await new FeedbackService(db).submit({
      workspaceId: 'ws-1',
      leadId: 'lead-1',
      actor: 'sales-1',
      rating: 4,
      body: 'useful',
      context: { action: 'handoff' },
    });
    expect(feedback).toMatchObject({ workspaceId: 'ws-1', leadId: 'lead-1', rating: 4 });
    expect(calls.some((call) => call.text.includes('INSERT INTO feedback'))).toBe(true);
    expect(calls.every((call) => !call.text.includes('product_event'))).toBe(true);
  });

  it('checks lead workspace before inserting feedback', async () => {
    const { db, calls } = fakeDb();
    await new FeedbackService(db).submit({ workspaceId: 'ws-1', leadId: 'lead-1', actor: 'u', rating: 5 });
    expect(calls[0].text).toContain('SELECT workspace_id FROM lead');
    expect(calls[1].text).toContain('INSERT INTO feedback');
  });

  it('rejects a lead from another workspace without inserting', async () => {
    const calls: Array<{ text: string; params?: unknown[] }> = [];
    const db = {
      query: async (text: string, params?: unknown[]) => {
        calls.push({ text, params });
        return text.includes('SELECT workspace_id')
          ? { rows: [{ workspace_id: 'ws-other' }] }
          : { rows: [] };
      },
    } as unknown as PostgresService;
    await expect(new FeedbackService(db).submit({ workspaceId: 'ws-1', leadId: 'lead-1', actor: 'u' })).rejects.toThrow('workspace mismatch');
    expect(calls).toHaveLength(1);
  });

  it('rejects invalid rating', async () => {
    const { db } = fakeDb();
    await expect(new FeedbackService(db).submit({ workspaceId: 'ws-1', actor: 'u', rating: 6 })).rejects.toThrow('rating');
  });

  it('requires workspace and actor', async () => {
    const { db } = fakeDb();
    await expect(new FeedbackService(db).submit({ workspaceId: '', actor: 'u' })).rejects.toThrow('workspaceId');
    await expect(new FeedbackService(db).submit({ workspaceId: 'ws-1', actor: '' })).rejects.toThrow('actor');
  });
});
