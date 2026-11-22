// ADR-009 §3: raw provider frames/responses are retained only under an explicit research-capture grant.
// Required: env AIL_RESEARCH_CAPTURE=explicit, spec.researchCapture { authorizedWorkspaceId, retentionDays 1..7 }.
// Storage, encryption at rest and automatic deletion are NOT built here; the returned retainUntil is the
// operator's deletion deadline and is written beside every research artifact.
import { createHmac, randomBytes } from 'node:crypto';

export const MAX_RESEARCH_RETENTION_DAYS = 7;
const DAY_MS = 86400000;
const ID = /^[A-Za-z0-9:_./-]{1,256}$/;

export function researchCaptureGate(env, spec, now = Date.now()) {
  if (env?.AIL_RESEARCH_CAPTURE !== 'explicit') throw new Error('research_capture_flag_required');
  const grant = spec?.researchCapture;
  if (!grant || typeof grant !== 'object' || !ID.test(grant.authorizedWorkspaceId ?? '')) throw new Error('research_workspace_required');
  if (!Number.isSafeInteger(grant.retentionDays) || grant.retentionDays < 1 || grant.retentionDays > MAX_RESEARCH_RETENTION_DAYS) {
    throw new Error('research_retention_invalid');
  }
  return Object.freeze({ authorizedWorkspaceId: grant.authorizedWorkspaceId, retentionDays: grant.retentionDays,
    retainUntil: new Date(now + grant.retentionDays * DAY_MS).toISOString(), deletion: 'operator-manual-not-automated' });
}

/**
 * Per-run keyed frame digest. The key is random, held in memory only and never written, so digests are
 * comparable within one run and unlinkable across runs; no unkeyed hash of frame content is produced.
 */
export function ephemeralFrameDigester(key = randomBytes(32)) {
  if (!(key instanceof Uint8Array) || key.byteLength < 32) throw new Error('invalid_ephemeral_key');
  return (raw) => createHmac('sha256', key).update(String(raw), 'utf8').digest('hex');
}
