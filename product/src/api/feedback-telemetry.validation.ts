import type { BoundaryError, RawBody } from './pilot-validation';

const objectBody = (body: RawBody): Record<string, unknown> | null =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;

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

const plainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const validateObject = (body: RawBody, field: string): BoundaryError[] => {
  const issues: BoundaryError[] = [];
  const obj = objectBody(body);
  if (!obj) return [{ field: 'body', code: 'OBJECT_REQUIRED', message: 'request body must be a JSON object' }];
  if (obj[field] !== undefined && !plainObject(obj[field])) {
    issues.push({ field, code: 'OBJECT_REQUIRED', message: `${field} must be a JSON object` });
  }
  return issues;
};

export function validateFeedbackBody(body: RawBody): BoundaryError[] {
  const issues = validateObject(body, 'context');
  const obj = objectBody(body);
  if (!obj) return issues;
  optionalString(obj, 'leadId', issues);
  optionalString(obj, 'body', issues);
  if (obj.rating !== undefined && (!Number.isInteger(obj.rating) || (obj.rating as number) < 1 || (obj.rating as number) > 5)) {
    issues.push({ field: 'rating', code: 'ENUM_INVALID', message: 'rating must be an integer from 1 to 5' });
  }
  return issues;
}

export function validateTelemetryBody(body: RawBody): BoundaryError[] {
  const issues = validateObject(body, 'payload');
  const obj = objectBody(body);
  if (!obj) return issues;
  requiredString(obj, 'eventType', issues);
  if (obj.releaseVersion !== undefined) requiredString(obj, 'releaseVersion', issues);
  if (obj.flagExposure !== undefined && !plainObject(obj.flagExposure)) {
    issues.push({ field: 'flagExposure', code: 'OBJECT_REQUIRED', message: 'flagExposure must be a JSON object' });
  }
  return issues;
}
