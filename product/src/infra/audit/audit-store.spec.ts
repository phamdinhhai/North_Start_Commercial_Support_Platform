import { describe, it, expect } from 'vitest';
import { AuditStore, type AuditRecord } from './audit-store';
import { createLead } from '../../domain/lead/lead';
import { createOutcome } from '../../domain/outcome/outcome';
import type { LeadId } from '../../domain/lead/lead';

const leadId = 'lead-001' as unknown as LeadId;
const ws = 'ws-1';

describe('AuditStore — C-06, R-19, I-05', () => {
  it('append stores a record with id + timestamp', () => {
    const store = new AuditStore();
    const record = store.append({
      entityType: 'lead',
      entityId: 'lead-001',
      workspaceId: ws,
      actor: 'sales-1',
      newValue: 'Accepted',
    });
    expect(record.id).toBeDefined();
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
    expect(record.entityType).toBe('lead');
  });

  it('getByEntity returns records in append order', () => {
    const store = new AuditStore();
    store.append({ entityType: 'lead', entityId: 'lead-001', workspaceId: ws, actor: 's', newValue: 'a' });
    store.append({ entityType: 'lead', entityId: 'lead-001', workspaceId: ws, actor: 's', newValue: 'b' });
    const records = store.getByEntity('lead', 'lead-001');
    expect(records).toHaveLength(2);
    expect(records[0].newValue).toBe('a');
    expect(records[1].newValue).toBe('b');
  });

  it('getByWorkspace returns workspace-scoped records', () => {
    const store = new AuditStore();
    store.append({ entityType: 'lead', entityId: 'l1', workspaceId: 'ws-1', actor: 's', newValue: 'a' });
    store.append({ entityType: 'lead', entityId: 'l2', workspaceId: 'ws-2', actor: 's', newValue: 'b' });
    const ws1 = store.getByWorkspace('ws-1');
    expect(ws1).toHaveLength(1);
    expect(ws1[0].workspaceId).toBe('ws-1');
  });

  it('corrections append — old + new both visible (I-05)', () => {
    const store = new AuditStore();
    const orig = store.append({
      entityType: 'outcome',
      entityId: 'out-1',
      workspaceId: ws,
      actor: 'sales-1',
      newValue: 'Won',
    });
    const correction = store.append({
      entityType: 'outcome',
      entityId: 'out-1',
      workspaceId: ws,
      actor: 'sales-1',
      newValue: 'Lost',
      previousValue: 'Won',
      supersedesRecordId: orig.id,
      reason: 'payment failed',
    });
    const all = store.getByEntity('outcome', 'out-1');
    expect(all).toHaveLength(2);
    expect(all[0].newValue).toBe('Won');
    expect(all[1].newValue).toBe('Lost');
    expect(all[1].supersedesRecordId).toBe(orig.id);
    expect(all[1].reason).toBe('payment failed');
  });

  it('count reflects total records', () => {
    const store = new AuditStore();
    expect(store.count).toBe(0);
    store.append({ entityType: 'lead', entityId: 'l1', workspaceId: ws, actor: 's', newValue: 'x' });
    store.append({ entityType: 'lead', entityId: 'l2', workspaceId: ws, actor: 's', newValue: 'y' });
    expect(store.count).toBe(2);
  });

  it('all() returns full append order', () => {
    const store = new AuditStore();
    store.append({ entityType: 'lead', entityId: 'l1', workspaceId: ws, actor: 's', newValue: 'a' });
    store.append({ entityType: 'lead', entityId: 'l2', workspaceId: ws, actor: 's', newValue: 'b' });
    expect(store.all()).toHaveLength(2);
    expect(store.all()[0].entityId).toBe('l1');
    expect(store.all()[1].entityId).toBe('l2');
  });

  it('append works with optional previousValue + reason + eventType', () => {
    const store = new AuditStore();
    const record = store.append({
      entityType: 'lead',
      entityId: 'lead-001',
      workspaceId: ws,
      actor: 'mgr',
      newValue: 'Follow-up',
      previousValue: 'Contacting',
      reason: 'client requested follow-up',
      eventType: 'state-transition',
    });
    expect(record.previousValue).toBe('Contacting');
    expect(record.reason).toBe('client requested follow-up');
    expect(record.eventType).toBe('state-transition');
  });

  it('empty store returns empty arrays', () => {
    const store = new AuditStore();
    expect(store.getByEntity('lead', 'nonexistent')).toEqual([]);
    expect(store.getByWorkspace('no-ws')).toEqual([]);
  });
});
