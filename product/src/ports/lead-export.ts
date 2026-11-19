export interface LeadExport {
  readonly schemaVersion: 1; readonly scope: 'single-lead-pilot-records'; readonly exportedAt: string;
  readonly workspaceId: string; readonly leadId: string; readonly synthetic: boolean | 'unknown';
  readonly records: Readonly<Record<string, readonly Record<string, unknown>[]>>;
  readonly exclusions: readonly string[];
}
export interface LeadExportStore { exportLead(workspaceId: string, leadId: string, actorId: string): Promise<LeadExport | undefined> }
export const LEAD_EXPORT_STORE=Symbol('LEAD_EXPORT_STORE');
export class LeadExportError extends Error {
  constructor(readonly code:'FORBIDDEN'|'INVALID_INPUT'|'NOT_FOUND'|'EXPORT_TOO_LARGE'|'DURABLE_STORAGE_REQUIRED',readonly status:number){super(code);}
}
