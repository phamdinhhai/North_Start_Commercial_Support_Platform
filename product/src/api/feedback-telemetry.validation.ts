import type { BoundaryError, RawBody } from './pilot-validation';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEEDBACK_ALLOWED_FIELDS = new Set(['leadId', 'rating', 'body', 'context']);
const TELEMETRY_ALLOWED_FIELDS = new Set(['eventType', 'payload', 'releaseVersion', 'flagExposure']);

export const MAX_FEEDBACK_BODY_CHARS = 4000;
export const MAX_FEEDBACK_CONTEXT_BYTES = 8 * 1024;
export const MAX_FEEDBACK_CONTEXT_DEPTH = 6;
export const MAX_FEEDBACK_CONTEXT_NODES = 128;
export const MAX_FEEDBACK_CONTEXT_KEYS = 32;

const plainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const rejectUnknownFields = (
  obj: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  issues: BoundaryError[],
): void => {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      issues.push({ field: key, code: 'UNKNOWN_FIELD', message: `${key} is not an allowed field` });
    }
  }
};

const requiredString = (obj: Record<string, unknown>, field: string, issues: BoundaryError[]): void => {
  const value = obj[field];
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push({ field, code: 'REQUIRED', message: `${field} must be a non-empty string` });
  }
};

const optionalString = (obj: Record<string, unknown>, field: string, issues: BoundaryError[]): void => {
  if (obj[field] !== undefined && (typeof obj[field] !== 'string' || obj[field].trim() === '')) {
    issues.push({ field, code: 'EMPTY', message: `${field} must be a non-empty string when provided` });
  }
};

const withinObjectBounds = (
  value: unknown,
  maxDepth: number,
  maxNodes: number,
  maxKeys: number,
): boolean => {
  const seen = new WeakSet<object>();
  let nodes = 0;
  const visit = (current: unknown, depth: number): boolean => {
    if (++nodes > maxNodes || depth > maxDepth) return false;
    if (current === null || typeof current !== 'object') return true;
    if (seen.has(current)) return false;
    seen.add(current);
    if (Array.isArray(current)) {
      if (current.length > maxKeys) return false;
      return current.every((item) => visit(item, depth + 1));
    }
    if (!plainObject(current)) return false;
    const keys = Object.keys(current);
    if (keys.length > maxKeys) return false;
    return keys.every((key) => visit(current[key], depth + 1));
  };
  return visit(value, 0);
};

const validateBoundedJsonObject = (
  value: unknown,
  field: string,
  maxBytes: number,
  issues: BoundaryError[],
): void => {
  if (!plainObject(value)) {
    issues.push({ field, code: 'OBJECT_REQUIRED', message: `${field} must be a JSON object` });
    return;
  }
  if (!withinObjectBounds(value, MAX_FEEDBACK_CONTEXT_DEPTH, MAX_FEEDBACK_CONTEXT_NODES, MAX_FEEDBACK_CONTEXT_KEYS)) {
    issues.push({ field, code: 'TOO_LARGE', message: `${field} exceeds allowed structure limits` });
    return;
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > maxBytes) {
      issues.push({ field, code: 'TOO_LARGE', message: `${field} must not exceed ${maxBytes} bytes` });
    }
  } catch {
    issues.push({ field, code: 'OBJECT_REQUIRED', message: `${field} must be a JSON-serializable object` });
  }
};

export function validateFeedbackBody(body: RawBody): BoundaryError[] {
  const issues: BoundaryError[] = [];
  if (!plainObject(body)) {
    return [{ field: 'body', code: 'OBJECT_REQUIRED', message: 'request body must be a JSON object' }];
  }
  rejectUnknownFields(body, FEEDBACK_ALLOWED_FIELDS, issues);
  if (body.leadId !== undefined) {
    if (typeof body.leadId !== 'string' || !UUID_PATTERN.test(body.leadId)) {
      issues.push({ field: 'leadId', code: 'UUID_INVALID', message: 'leadId must be a valid UUID' });
    }
  }
  optionalString(body, 'body', issues);
  if (typeof body.body === 'string' && body.body.length > MAX_FEEDBACK_BODY_CHARS) {
    issues.push({ field: 'body', code: 'TOO_LARGE', message: `body must not exceed ${MAX_FEEDBACK_BODY_CHARS} characters` });
  }
  if (body.context !== undefined) {
    validateBoundedJsonObject(body.context, 'context', MAX_FEEDBACK_CONTEXT_BYTES, issues);
  }
  if (body.rating !== undefined && (!Number.isInteger(body.rating) || (body.rating as number) < 1 || (body.rating as number) > 5)) {
    issues.push({ field: 'rating', code: 'ENUM_INVALID', message: 'rating must be an integer from 1 to 5' });
  }
  return issues;
}

export function validateTelemetryBody(body: RawBody): BoundaryError[] {
  const issues: BoundaryError[] = [];
  if (!plainObject(body)) {
    return [{ field: 'body', code: 'OBJECT_REQUIRED', message: 'request body must be a JSON object' }];
  }
  rejectUnknownFields(body, TELEMETRY_ALLOWED_FIELDS, issues);
  requiredString(body, 'eventType', issues);
  if (body.releaseVersion !== undefined) requiredString(body, 'releaseVersion', issues);
  if (body.payload !== undefined && !plainObject(body.payload)) {
    issues.push({ field: 'payload', code: 'OBJECT_REQUIRED', message: 'payload must be a JSON object' });
  }
  if (body.flagExposure !== undefined && !plainObject(body.flagExposure)) {
    issues.push({ field: 'flagExposure', code: 'OBJECT_REQUIRED', message: 'flagExposure must be a JSON object' });
  }
  return issues;
}
