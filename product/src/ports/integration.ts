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
export interface IntegrationStore {
    enroll(value: Enrollment): Promise<void>;
    revoke(id: string): Promise<void>;
    append(enrollment: Enrollment, upload: Upload, fingerprint: string): Promise<ReceiptAck>;
}
