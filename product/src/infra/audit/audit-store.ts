import { randomUUID } from 'node:crypto';
import type { LeadId } from '../../domain/lead/lead';

/** AuditRecord — append-only, actor + previous/new + timestamp + reason (I-05, R-19). */
export interface AuditRecord {
  readonly id: string;
  readonly entityType: 'lead' | 'customer' | 'handoff' | 'outcome' | 'commercial-event';
  readonly entityId: string;
  readonly workspaceId: string;
  readonly actor: string;
  readonly previousValue?: string;
  readonly newValue: string;
  readonly timestamp: string;
  readonly reason?: string;
  readonly eventType?: string;
  /** If this record supersedes another (I-05 append) — correction chain. */
  readonly supersedesRecordId?: string;
}

/**
 * AuditStore — append-only, in-memory (C-06, R-19, I-05).
 * I-05: NO update, NO delete methods. Corrections append new records.
 * Persistence deferred to PH3 (PostgreSQL).
 */
export class AuditStore {
  private readonly records: AuditRecord[] = [];
  private readonly byEntity = new Map<string, AuditRecord[]>();
  private readonly byWorkspace = new Map<string, AuditRecord[]>();

  /** Append an audit record — the ONLY mutation (I-05). */
  append(input: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord {
    const record: AuditRecord = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...input,
    };
    this.records.push(record);

    const entityKey = `${record.entityType}:${record.entityId}`;
    const entityList = this.byEntity.get(entityKey) ?? [];
    entityList.push(record);
    this.byEntity.set(entityKey, entityList);

    const wsList = this.byWorkspace.get(record.workspaceId) ?? [];
    wsList.push(record);
    this.byWorkspace.set(record.workspaceId, wsList);

    return record;
  }

  /** All records for an entity, in append order (I-05 — history visible). */
  getByEntity(entityType: AuditRecord['entityType'], entityId: string): readonly AuditRecord[] {
    return this.byEntity.get(`${entityType}:${entityId}`) ?? [];
  }

  /** All records for a workspace (R-19, I-09 scoped), append order. */
  getByWorkspace(workspaceId: string): readonly AuditRecord[] {
    return this.byWorkspace.get(workspaceId) ?? [];
  }

  /** Full append order (for debugging / exports). */
  all(): readonly AuditRecord[] {
    return [...this.records];
  }

  get count(): number {
    return this.records.length;
  }
}
