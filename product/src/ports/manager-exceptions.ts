export type ManagerClassification = 'real' | 'synthetic' | 'unknown' | 'all';
export type ManagerObservation = 'owner_unassigned' | 'awaiting_acceptance' | 'recipient_inactive' | 'recipient_unknown' | 'overdue_open_work' | 'claimed_outcome_with_open_work' | 'source_evidence_missing' | 'context_unknown' | 'source_unknown';
export interface ManagerExceptionsQuery { workspaceId: string; classification: ManagerClassification; limit: number; after?: string }
/** Metadata only. No evidence content, action text, identity links or financial claims. */
export interface ManagerExceptionRow {
 leadId: string; displayName: string; version: number; classification: Exclude<ManagerClassification,'all'>;
 ownerMissing: boolean; awaitingSince: string | null; recipientState: 'active'|'inactive'|'unknown'|null;
 overdue: boolean; claimedWithOpen: boolean; evidenceMissing: boolean; contextUnknown: boolean; sourceUnknown: boolean;
}
export interface ManagerExceptionsReader { scan(query: ManagerExceptionsQuery): Promise<readonly ManagerExceptionRow[]> }
export const MANAGER_EXCEPTIONS_READER = Symbol('MANAGER_EXCEPTIONS_READER');
export class ManagerExceptionsUnavailable extends Error {
 readonly code = 'DURABLE_STORAGE_REQUIRED';
 constructor() { super('Manager exceptions require durable storage'); }
}
export interface ManagerExceptionItem {
 leadId: string; displayName: string; version: number; classification: Exclude<ManagerClassification,'all'>;
 observations: readonly ManagerObservation[]; awaitingSince?: string; awaitingAgeSeconds?: number;
}
