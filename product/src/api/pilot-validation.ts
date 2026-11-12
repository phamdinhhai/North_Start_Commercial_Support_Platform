/**
 * P1-4 — boundary validation for the pilot HTTP surface.
 *
 * `main.ts` installs no global ValidationPipe, and the controller's body parameters are
 * structural types only (erased at runtime), so before this module any string was accepted
 * as an enum value and missing/blank required fields reached the store or the DB. Everything
 * entering `/v1/pilot/*` is validated HERE, before a single domain call, and reported as
 * 400 + a machine-readable list of field issues (INPUT_INVALID).
 *
 * Deliberately hand-written rather than decorator-based: the domain enums in `pilot.types`
 * stay the single source of truth, and the checks remain callable from unit tests without
 * wiring a global pipe into Fastify (which would change behaviour for other controllers).
 */
import { UNKNOWN_SENTINEL } from '../domain/unknown-states/unknown-states';
import type { CompletionEvidence, PilotErrorCode, ResponsibleParty, WorkOrigin } from '../ports/pilot-loop.types';

export interface BoundaryError {
  readonly field: string;
  readonly code: 'REQUIRED' | 'ENUM_INVALID' | 'DATE_INVALID' | 'OBJECT_REQUIRED' | 'EMPTY';
  readonly message: string;
}

type Unknown = Record<string, unknown> | null | undefined;

/** Public signature: any runtime value can arrive from HTTP, including a bare string or array. */
export type RawBody = unknown;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function required(obj: Unknown, field: string, out: BoundaryError[]): string | undefined {
  const raw = obj?.[field];
  if (typeof raw !== 'string' || raw.trim() === '') {
    out.push({ field, code: 'REQUIRED', message: `${field} must be a non-empty string` });
    return undefined;
  }
  return raw;
}

function oneOf<T extends string>(obj: Unknown, field: string, allowed: readonly T[], out: BoundaryError[], requiredField = true): T | undefined {
  const raw = obj?.[field];
  if (raw === undefined || raw === null || raw === '') {
    if (requiredField) out.push({ field, code: 'REQUIRED', message: `${field} is required` });
    return undefined;
  }
  if (typeof raw !== 'string' || !(allowed as readonly string[]).includes(raw)) {
    out.push({ field, code: 'ENUM_INVALID', message: `${field} must be one of: ${allowed.join(', ')}` });
    return undefined;
  }
  return raw as T;
}

/**
 * ISO-8601 check. Strict enough to reject prose ("thứ Hai tuần sau") which used to land in a
 * TIMESTAMPTZ column as a 500, while still accepting offset, `Z`, and date-only forms.
 * `unknown` (UNKNOWN_SENTINEL) is legal ONLY for occurredAt — callers pass it explicitly when
 * the event time is unclear instead of letting us invent it (Q4).
 */
function isoDate(obj: Unknown, field: string, out: BoundaryError[], allowUnknownSentinel = false): string | undefined {
  const raw = obj?.[field];
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') {
    out.push({ field, code: 'DATE_INVALID', message: `${field} must be an ISO-8601 string` });
    return undefined;
  }
  if (allowUnknownSentinel && raw === UNKNOWN_SENTINEL) return raw;
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    out.push({ field, code: 'DATE_INVALID', message: `${field} must be an ISO-8601 date-time (or "${UNKNOWN_SENTINEL}" for occurredAt when genuinely unclear)` });
    return undefined;
  }
  return raw;
}

/** Narrow the raw value: a JSON object is the only body shape any field check accepts. */
function asObject(body: RawBody): Record<string, unknown> | null {
  return isPlainObject(body) ? body : null;
}

const SPEAKERS = ['customer', 'staff'] as const;
const PARTIES: readonly ResponsibleParty[] = ['internal', 'external'];
const ORIGINS: readonly WorkOrigin[] = ['explicit-request', 'explicit-commitment', 'policy-sla', 'inferred'];
const EVIDENCE: readonly CompletionEvidence[] = ['observed', 'declared', 'inferred', 'absent', 'conflicted'];
const OUTCOMES = ['Won', 'Lost', 'Unknown'] as const;
const STAGES = ['Contacting', 'Follow-up'] as const;

export function validateIntakeBody(body: RawBody): BoundaryError[] {
  const out: BoundaryError[] = [];
  const obj = asObject(body);
  if (!obj) {
    out.push({ field: "body", code: "OBJECT_REQUIRED", message: "request body must be a JSON object" });
    return out;
  }
  required(obj, 'displayName', out);
  required(obj, 'utterance', out);
  required(obj, 'connection', out);
  required(obj, 'externalRecordId', out);
  oneOf(obj, 'speaker', SPEAKERS, out);
  isoDate(obj, 'occurredAt', out, true);
  if (obj.isSynthetic !== undefined && typeof obj.isSynthetic !== 'boolean') {
    out.push({ field: 'isSynthetic', code: 'ENUM_INVALID', message: 'isSynthetic must be a boolean' });
  }
  return out;
}

export function validateHandoffBody(body: RawBody): BoundaryError[] {
  const out: BoundaryError[] = [];
  const obj = asObject(body);
  if (!obj) {
    out.push({ field: "body", code: "OBJECT_REQUIRED", message: "request body must be a JSON object" });
    return out;
  }
  required(obj, 'context', out);
  required(obj, 'proposedAction', out);
  required(obj, 'recipientUserId', out);
  oneOf(obj, 'responsibleParty', PARTIES, out);
  oneOf(obj, 'origin', ORIGINS, out);
  isoDate(obj, 'dueAt', out);
  if (obj.evidenceRef !== undefined) required(obj, 'evidenceRef', out);
  return out;
}

export function validateAcceptBody(body: RawBody): BoundaryError[] {
  const out: BoundaryError[] = [];
  const obj = asObject(body);
  if (!obj) {
    out.push({ field: "body", code: "OBJECT_REQUIRED", message: "request body must be a JSON object" });
    return out;
  }
  required(obj, 'workId', out);
  required(obj, 'reason', out);
  return out;
}

export function validateAdvanceBody(body: RawBody): BoundaryError[] {
  const out: BoundaryError[] = [];
  const obj = asObject(body);
  if (!obj) {
    out.push({ field: "body", code: "OBJECT_REQUIRED", message: "request body must be a JSON object" });
    return out;
  }
  oneOf(obj, 'to', STAGES, out);
  required(obj, 'reason', out);
  return out;
}

export function validateCompleteBody(body: RawBody): BoundaryError[] {
  const out: BoundaryError[] = [];
  const obj = asObject(body);
  if (!obj) {
    out.push({ field: "body", code: "OBJECT_REQUIRED", message: "request body must be a JSON object" });
    return out;
  }
  required(obj, 'workId', out);
  oneOf(obj, 'evidence', EVIDENCE, out);
  isoDate(obj, 'occurredAt', out, true);
  if (obj.evidenceRef !== undefined) required(obj, 'evidenceRef', out);
  if (obj.reason !== undefined) required(obj, 'reason', out);
  return out;
}

export function validateRescheduleBody(body: RawBody): BoundaryError[] {
  const out: BoundaryError[] = [];
  const obj = asObject(body);
  if (!obj) {
    out.push({ field: "body", code: "OBJECT_REQUIRED", message: "request body must be a JSON object" });
    return out;
  }
  required(obj, 'workId', out);
  required(obj, 'reason', out);
  // newDueAt is the whole point of the call → required AND parseable (no sentinel).
  if (obj.newDueAt === undefined || obj.newDueAt === null || obj.newDueAt === '') {
    out.push({ field: 'newDueAt', code: 'REQUIRED', message: 'newDueAt is required' });
  } else {
    isoDate(obj, 'newDueAt', out);
  }
  return out;
}

export function validateUnobservedBody(body: RawBody): BoundaryError[] {
  const out: BoundaryError[] = [];
  const obj = asObject(body);
  if (!obj) {
    out.push({ field: "body", code: "OBJECT_REQUIRED", message: "request body must be a JSON object" });
    return out;
  }
  required(obj, 'workId', out);
  return out;
}

export function validateOutcomeBody(body: RawBody): BoundaryError[] {
  const out: BoundaryError[] = [];
  const obj = asObject(body);
  if (!obj) {
    out.push({ field: "body", code: "OBJECT_REQUIRED", message: "request body must be a JSON object" });
    return out;
  }
  oneOf(obj, 'value', OUTCOMES, out);
  if (obj.reason !== undefined) required(obj, 'reason', out);
  return out;
}

/** HTTP-facing error for a rejected payload — mapped by the controller to 400 INPUT_INVALID. */
export function boundaryRejection(issues: readonly BoundaryError[]): { status: 400; code: PilotErrorCode; message: string; details: { issues: readonly BoundaryError[] } } {
  return {
    status: 400 as const,
    code: 'INPUT_INVALID' as PilotErrorCode,
    message: issues.map((i) => `${i.field}: ${i.message}`).join('; '),
    details: { issues },
  };
}
