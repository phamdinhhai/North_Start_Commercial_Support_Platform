import type { SourceConnection, SourceObservation } from './source-observation';

/** A read projection, never an authentication credential or stored provider assertion. */
export interface SourceTrustProjection {
  readonly sourceAuthority: 'synthetic_fixture';
  readonly verification: 'UNVERIFIED';
  readonly admission: 'LEGACY_UNVERIFIED' | 'SERVER_BOUND_SYNTHETIC';
  readonly authority: 'LEGACY_UNVERIFIED' | 'LOCAL_SYNTHETIC_FIXTURE';
  readonly transportIdentity: 'LOCAL_ADMIN_SIMULATION' | 'UNKNOWN';
  readonly origin: 'LOCAL_FIXTURE';
  readonly nativeMapping: 'USER_ASSERTED_CANDIDATE' | 'UNKNOWN';
  readonly providerAttestation: 'NOT_AVAILABLE';
  readonly independentVerification: 'NOT_AVAILABLE';
}

export interface SyntheticSourceAdmission {
  readonly workspaceId: string;
  readonly connection: SourceConnection;
}

export type SourceTrustObservation = Pick<SourceObservation,
  'provider' | 'route' | 'accountId' | 'synthetic' | 'sourceAuthority' | 'verification' | 'native'>;
