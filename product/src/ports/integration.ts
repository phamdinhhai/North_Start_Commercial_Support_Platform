/** Experimental metadata receipt contracts. OPEN: PM-1; no commercial mutation authority. */
export interface IntegrationScope {
    workspaceId: string;
    connectionId: string;
    accountId: string;
    providerSurface: 'pancake-conversations';
    pageId: string;
}
export interface Enrollment {
    id: string;
    scope: IntegrationScope;
    expiresAt: string;
}
export interface Upload {
    captureId: string;
    sequence: number;
    pageId: string;
    observation: Record<string, unknown>;
}
export interface ReceiptAck {
    captureId: string;
    sequence: number;
    enrollmentId: string;
    receiptId: string;
    disposition: 'stored' | 'duplicate';
    checkpoint: number;
    continuity: 'UNKNOWN';
}
export class IntegrationError extends Error {
    constructor(readonly code: string, readonly status: number) { super(code); }
}
/**
 * Who issued or revoked an enrollment. Never contains token material or key secrets.
 * `issuance` distinguishes the deprecated shared-secret path from an authenticated principal.
 * OPEN: PM-1 — reuses existing manager/admin workspace authority; no new role is introduced.
 */
export interface EnrollmentActor {
    issuance: 'principal' | 'issuer-secret';
    actorId: string;
    role: 'admin' | 'manager' | null;
}
export interface IssuanceAudit extends EnrollmentActor {
    kid: string;
}
export interface RevocationRequest extends EnrollmentActor {
    /** When set, the enrollment must belong to this server-resolved workspace (else not found). */
    workspaceId: string | null;
}
export interface IntegrationStore {
    enroll(value: Enrollment, audit: IssuanceAudit): Promise<void>;
    revoke(id: string, request: RevocationRequest): Promise<void>;
    append(enrollment: Enrollment, upload: Upload, fingerprint: string): Promise<ReceiptAck>;
}
