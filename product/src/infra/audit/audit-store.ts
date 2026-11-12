import { randomUUID } from 'node:crypto';
import type { AuditRecord } from '../../ports/audit';
export type { AuditRecord } from '../../ports/audit';

/**
 * AuditStore — append-only, in-memory (C-06, R-19, I-05).
 * I-05: NO update, NO delete methods. Corrections append new records.
 * Persistence deferred to PH3 (PostgreSQL).
 */
const rollbackers = new WeakMap<AuditStore, (records: readonly AuditRecord[]) => void>();

/** Timestamp is the primary order; stable in-memory sort preserves append order for ties. */
export function compareAuditRecords(a: Pick<AuditRecord, 'timestamp'>, b: Pick<AuditRecord, 'timestamp'>): number {
  return a.timestamp.localeCompare(b.timestamp);
}

export class AuditStore {
  private readonly records: AuditRecord[] = [];
  private readonly byEntity = new Map<string, AuditRecord[]>();
  private readonly byWorkspace = new Map<string, AuditRecord[]>();
  private lastTimestamp = '';

  constructor() {
    rollbackers.set(this, (records) => {
      if (records.length === 0) return;
      const ids = new Set(records.map((r) => r.id));
      for (let i = this.records.length - 1; i >= 0; i--) if (ids.has(this.records[i].id)) this.records.splice(i, 1);
      for (const [key, list] of this.byEntity) {
        const kept = list.filter((r) => !ids.has(r.id));
        if (kept.length) this.byEntity.set(key, kept); else this.byEntity.delete(key);
      }
      for (const [key, list] of this.byWorkspace) {
        const kept = list.filter((r) => !ids.has(r.id));
        if (kept.length) this.byWorkspace.set(key, kept); else this.byWorkspace.delete(key);
      }
    });
  }

  /** Append an audit record — the ONLY mutation exposed by the store (I-05). */
  append(input: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord {
    const generatedTimestamp = new Date().toISOString();
    const timestamp = generatedTimestamp > this.lastTimestamp ? generatedTimestamp : this.lastTimestamp;
    this.lastTimestamp = timestamp;
    const record: AuditRecord = {
      id: randomUUID(),
      timestamp,
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

  /** All records for an entity, in deterministic append order (I-05 — history visible). */
  getByEntity(entityType: AuditRecord['entityType'], entityId: string): readonly AuditRecord[] {
    return [...(this.byEntity.get(`${entityType}:${entityId}`) ?? [])].sort(compareAuditRecords);
  }

  /** All records for a workspace (R-19, I-09 scoped), deterministic order. */
  getByWorkspace(workspaceId: string): readonly AuditRecord[] {
    return [...(this.byWorkspace.get(workspaceId) ?? [])].sort(compareAuditRecords);
  }

  /** Full deterministic order (for debugging / exports). */
  all(): readonly AuditRecord[] {
    return [...this.records].sort(compareAuditRecords);
  }

  get count(): number {
    return this.records.length;
  }
}

/** Internal transaction rollback capability; intentionally not part of AuditStore's public API. */
export function rollbackAuditAppend(store: AuditStore, records: readonly AuditRecord[]): void {
  rollbackers.get(store)?.(records);
}
