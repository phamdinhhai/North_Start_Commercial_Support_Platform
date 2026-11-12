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
  readonly supersedesRecordId?: string;
}
