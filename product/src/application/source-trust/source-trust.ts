import { SourceIntegrationError } from '../../ports/source-observation';
import type { SourceTrustObservation, SourceTrustProjection, SyntheticSourceAdmission } from '../../ports/source-trust';

/** ADR-007: checks a server-loaded connection; it cannot authenticate provider traffic. */
export function assertSyntheticSourceAdmission(o: SourceTrustObservation, context: SyntheticSourceAdmission): void {
  const c = context.connection;
  if (c.workspaceId !== context.workspaceId) throw new SourceIntegrationError('CONNECTION_NOT_FOUND', 404);
  if (c.status !== 'active') throw new SourceIntegrationError('CONNECTION_REVOKED', 403);
  if (o.synthetic !== true || o.sourceAuthority !== 'synthetic_fixture' || o.verification !== 'UNVERIFIED') {
    throw new SourceIntegrationError('SOURCE_TRUST_INVALID', 400);
  }
  if (c.provider !== o.provider || c.route !== o.route || c.pageId !== o.accountId ||
      o.route !== `${o.provider}-synthetic`) throw new SourceIntegrationError('SOURCE_SCOPE_MISMATCH', 403);
  assertSyntheticNativeIdentity(o);
}

/** Declared Pancake-to-Meta mapping is permitted only as a fabricated candidate. */
export function assertSyntheticNativeIdentity(o: SourceTrustObservation): void {
  const n = o.native;
  if ((o.provider === 'meta-page' && (n.system === 'pancake' || (n.pageId !== null && n.pageId !== o.accountId))) ||
      (n.system === null && Object.entries(n).some(([key, value]) => key !== 'system' && value !== null)) ||
      (n.revision !== null && n.eventId === null)) {
    throw new SourceIntegrationError('SOURCE_NATIVE_INVALID', 400);
  }
}

/**
 * I-08/I-12: history is not rewritten or promoted by client labels. The caller may provide
 * a server-loaded admission context; absence means legacy unverified admission. No raw
 * text, original payload, IDs, credentials or claimed provider assurance enter this shape.
 */
export function projectSourceTrust(o: SourceTrustObservation, context?: SyntheticSourceAdmission): SourceTrustProjection {
  if (context) assertSyntheticSourceAdmission(o, context);
  return {
    sourceAuthority: 'synthetic_fixture', verification: 'UNVERIFIED',
    admission: context ? 'SERVER_BOUND_SYNTHETIC' : 'LEGACY_UNVERIFIED',
    authority: context ? 'LOCAL_SYNTHETIC_FIXTURE' : 'LEGACY_UNVERIFIED',
    transportIdentity: context ? 'LOCAL_ADMIN_SIMULATION' : 'UNKNOWN', origin: 'LOCAL_FIXTURE',
    nativeMapping: o.native.system && o.native.pageId && o.native.messageId ? 'USER_ASSERTED_CANDIDATE' : 'UNKNOWN',
    providerAttestation: 'NOT_AVAILABLE', independentVerification: 'NOT_AVAILABLE',
  };
}
