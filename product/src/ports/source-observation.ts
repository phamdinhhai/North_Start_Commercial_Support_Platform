import type { AuthContext } from './auth';
import type { CommercialEnvelope } from '../domain/envelope/envelope';

/** ADR-005/007: fabricated source evidence only; never a verified provider event. */
export type SourceProvider = 'pancake' | 'meta-page';
export type SourceRoute = 'pancake-synthetic' | 'meta-page-synthetic';
export interface SourceObservation {
  readonly schemaVersion: 1;
  readonly provider: SourceProvider;
  readonly route: SourceRoute;
  readonly synthetic: true;
  readonly sourceAuthority: 'synthetic_fixture';
  readonly completeness: 'UNKNOWN' | 'partial';
  readonly verification: 'UNVERIFIED';
  readonly receiptId: string;
  readonly native: {
    readonly system: 'meta' | 'pancake' | null;
    readonly pageId: string | null;
    readonly conversationId: string | null;
    readonly messageId: string | null;
    readonly eventId: string | null;
    readonly revision: string | null;
  };
  readonly observedAt: string;
  readonly occurredAt: string | null;
  readonly lifecycle: 'upsert-observed' | 'deletion-labelled';
  readonly displayName: string;
  readonly rawPayload: {
    readonly utterance: string;
    readonly speaker: 'customer' | 'staff' | 'unknown';
    readonly original: Record<string, unknown>;
  };
}
export interface SourceConnection {
  readonly id: string;
  readonly workspaceId: string;
  readonly provider: SourceProvider;
  readonly route: SourceRoute;
  readonly pageId: string;
  readonly status: 'active' | 'revoked';
  readonly health: 'SYNTHETIC_ONLY';
}
export interface SourceReceipt {
  readonly receiptId: string;
  readonly connectionId: string;
  readonly leadId: string | null;
  readonly envelopeId: string | null;
  readonly disposition: 'stored' | 'receipt_duplicate' | 'object_aligned' | 'distinct_event' | 'unknown';
  readonly quarantineReason: 'UNKNOWN_NATIVE_ID' | null;
  readonly verification: 'UNVERIFIED';
  readonly completeness: 'UNKNOWN';
}
export interface SourceEvidence {
  readonly receipt: SourceReceipt;
  readonly observation: Omit<SourceObservation, 'rawPayload'>;
  readonly envelope: CommercialEnvelope;
}
export interface SourceIntegrationStore {
  createConnection(ctx: AuthContext, input: Pick<SourceConnection, 'provider' | 'route' | 'pageId'>): Promise<SourceConnection>;
  revokeConnection(ctx: AuthContext, id: string): Promise<SourceConnection>;
  listConnections(workspaceId: string): Promise<readonly SourceConnection[]>;
  intake(ctx: AuthContext, connectionId: string, observation: SourceObservation, options?: { readonly claimResponsibility: boolean }): Promise<SourceReceipt>;
  evidence(workspaceId: string, leadId: string, actorId: string): Promise<readonly SourceEvidence[]>;
}
export class SourceIntegrationError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
export const SOURCE_INTEGRATION_SERVICE = Symbol('SOURCE_INTEGRATION_SERVICE');
