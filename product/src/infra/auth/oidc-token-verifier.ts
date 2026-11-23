import { decodeProtectedHeader, errors, jwtVerify } from 'jose';
import type { AccessTokenVerifier, TokenRejectionReason, TokenVerification } from '../../ports/auth';
import type { OidcConfig } from './oidc-config';
import { JwksUnavailableError, type JwksKeyStore } from './jwks-key-store';

/**
 * OIDC access-token verifier built on `jose` (no hand-rolled crypto).
 * Enforces: algorithm allowlist (asymmetric only; `none`/HS* never), `kid` present, signature
 * against the sanitized JWKS, exact issuer, audience, `exp` required, `nbf`, bounded clock skew.
 * Only `(iss, sub)` leave this class: role/workspace/email/group claims are ignored by design.
 * // ADR-006 — IdP claims/groups never grant authority (no token→capability mapping); access
 * token lifetime ≤ 15 min so IdP-side deactivation takes effect within that bound.
 */
const MAX_TOKEN_BYTES = 8192;
/** ADR-006: access token TTL ≤ 15 minutes. */
export const MAX_ACCESS_TOKEN_LIFETIME_SECONDS = 900;
const MAX_SUBJECT_LENGTH = 255;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
/**
 * Accepted JOSE `typ` values (absent is tolerated: many IdPs omit it). Anything else — notably
 * AIL enrollment tokens (`typ: 'AIL-ENROLLMENT'`) — is never a login credential.
 */
const ACCEPTED_TYP = new Set(['jwt', 'at+jwt', 'application/at+jwt']);

export class OidcTokenVerifier implements AccessTokenVerifier {
  constructor(
    private readonly config: OidcConfig,
    private readonly keys: JwksKeyStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async verify(token: string): Promise<TokenVerification> {
    if (typeof token !== 'string' || token.length === 0) return reject('malformed');
    if (token.length > MAX_TOKEN_BYTES) return reject('too_large');
    if (token.split('.').length !== 3) return reject('malformed');
    let header: ReturnType<typeof decodeProtectedHeader>;
    try {
      header = decodeProtectedHeader(token);
    } catch {
      return reject('malformed');
    }
    // Checked before any key lookup so `none`/HS* tokens cannot even trigger a JWKS refetch.
    if (typeof header.alg !== 'string' || !this.config.algorithms.includes(header.alg)) return reject('alg_not_allowed');
    if (header.typ !== undefined && (typeof header.typ !== 'string' || !ACCEPTED_TYP.has(header.typ.toLowerCase()))) {
      return reject('token_type');
    }
    if (typeof header.kid !== 'string' || header.kid.length === 0 || header.kid.length > 256) return reject('missing_kid');
    try {
      const { payload } = await jwtVerify(token, this.keys.getKey, {
        issuer: this.config.issuer,
        audience: [...this.config.audiences],
        algorithms: [...this.config.algorithms],
        clockTolerance: this.config.clockSkewSeconds,
        requiredClaims: ['exp', 'sub'],
        currentDate: this.now(),
      });
      const subject = payload.sub;
      if (typeof subject !== 'string' || subject.length === 0 || subject.length > MAX_SUBJECT_LENGTH ||
          CONTROL_CHARS.test(subject)) {
        return reject('missing_claim');
      }
      const exp = payload.exp as number; // required claim, validated by jwtVerify
      const nowSeconds = Math.floor(this.now().getTime() / 1000);
      if ((typeof payload.iat === 'number' && exp - payload.iat > MAX_ACCESS_TOKEN_LIFETIME_SECONDS) ||
          exp - nowSeconds > MAX_ACCESS_TOKEN_LIFETIME_SECONDS + this.config.clockSkewSeconds) {
        return reject('lifetime');
      }
      return { ok: true, principal: { issuer: this.config.issuer, subject } };
    } catch (error) {
      return reject(classify(error));
    }
  }
}

function reject(reason: TokenRejectionReason): TokenVerification {
  return { ok: false, reason };
}

function classify(error: unknown): TokenRejectionReason {
  if (error instanceof JwksUnavailableError) return 'jwks_unavailable';
  if (error instanceof errors.JWTExpired) return 'expired';
  if (error instanceof errors.JWTClaimValidationFailed) {
    if (error.reason === 'missing') return 'missing_claim';
    if (error.claim === 'nbf') return 'not_yet_valid';
    if (error.claim === 'iss') return 'issuer';
    if (error.claim === 'aud') return 'audience';
    return 'malformed';
  }
  if (error instanceof errors.JOSEAlgNotAllowed) return 'alg_not_allowed';
  if (error instanceof errors.JWKSNoMatchingKey) return 'unknown_key';
  if (error instanceof errors.JWSSignatureVerificationFailed) return 'signature';
  return 'malformed';
}
