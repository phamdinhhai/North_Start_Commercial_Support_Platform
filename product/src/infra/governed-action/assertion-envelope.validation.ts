import type { AssertionEnvelope } from '../../domain/commercial-event/commercial-event';
import { decodeDigest } from '../../ports/versioned-content-digest';

/** ADR-005: validate the non-inferred evidence contract before invoking any sink. */
export function validDeliveryEnvelope(value: unknown, workspaceId: string, assertionId: string): value is AssertionEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const allowed = new Set(['assertionId','workspaceId','subjectType','subjectId','eventType','value','assertionStatus','acquisitionMode','sourceSystem','sourceRecordId','sourceActor','capturedAt','ingestedAt','rawEvidencePointer','rawPayloadHash','rawPayloadDigest','schemaVersion','createdBy','supersedesAssertionId','createdAt','evidenceSummary']);
  if (Object.keys(v).some(k => !allowed.has(k))) return false;
  const required = ['assertionId','workspaceId','subjectId','eventType','value','sourceSystem','sourceActor','createdBy'];
  if (!required.every(k => typeof v[k] === 'string' && (v[k] as string).trim().length > 0)) return false;
  if (v.workspaceId !== workspaceId || v.assertionId !== assertionId || v.schemaVersion !== 1) return false;
  if (!['lead','customer','handoff','external_resource'].includes(String(v.subjectType)) ||
      !['observed','claimed','imported','user_confirmed'].includes(String(v.acquisitionMode)) ||
      !['draft','claimed','corroborated','superseded'].includes(String(v.assertionStatus))) return false;
  if ('confidence' in v || 'inferredMeaning' in v) return false;
  if (!['capturedAt','ingestedAt','createdAt'].every(k => typeof v[k] === 'string' && Number.isFinite(Date.parse(v[k] as string)))) return false;
  for (const k of ['sourceRecordId','rawEvidencePointer','rawPayloadHash','supersedesAssertionId']) {
    if (v[k] !== undefined && (typeof v[k] !== 'string' || !(v[k] as string).trim())) return false;
  }
  if (v.eventType === 'ACTION_OUTCOME_OBSERVED') {
    // ADR-009 (A-02): readback outcome evidence must carry a keyed HMAC digest with structured kid/algorithm/value.
    if (typeof v.rawPayloadHash !== 'string' || !decodeDigest(v.rawPayloadHash) || v.rawPayloadDigest === undefined) return false;
  }
  if (v.rawPayloadDigest !== undefined) {
    if (!v.rawPayloadDigest || typeof v.rawPayloadDigest !== 'object' || Array.isArray(v.rawPayloadDigest)) return false;
    const d = v.rawPayloadDigest as Record<string, unknown>;
    if (Object.keys(d).sort().join(',') !== 'algorithm_version,kid,value' ||
        d.algorithm_version !== 'hmac-sha256-v1' ||
        typeof d.kid !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(d.kid) ||
        typeof d.value !== 'string' || !/^[a-f0-9]{64}$/.test(d.value)) return false;
    const token = typeof v.rawPayloadHash === 'string' ? decodeDigest(v.rawPayloadHash) : undefined;
    if (token && (token.kid !== d.kid || token.value !== d.value)) return false;
    if (!token && v.rawPayloadHash !== undefined && v.rawPayloadHash !== d.value) return false;
  }
  if (v.evidenceSummary !== undefined) {
    if (!v.evidenceSummary || typeof v.evidenceSummary !== 'object' || Array.isArray(v.evidenceSummary)) return false;
    if (!Object.values(v.evidenceSummary).every(x => x === null || typeof x === 'string' || typeof x === 'boolean' || (typeof x === 'number' && Number.isFinite(x)))) return false;
  }
  return true;
}
