import { createHash } from 'node:crypto';
import { GovernedActionError, type JsonValue } from './governed-action.types';

const MAX_DEPTH = 32;
const MAX_CANONICAL_BYTES = 64 * 1024;

/**
 * Deterministic JSON serialization used for the frozen argument digest.
 *
 * - Object keys are sorted by UTF-16 code unit at every depth; arrays keep their order.
 * - Only plain JSON values are accepted. `undefined`, functions, symbols, bigint,
 *   non-finite numbers, class instances (Date/Map/...) and cycles fail closed, so two
 *   semantically different inputs can never share a canonical form by accident.
 * - Money must be carried as integer strings in minor units, not floats.
 */
export function canonicalJson(value: unknown): string {
  const out = serialize(value, 0, new Set<object>());
  if (Buffer.byteLength(out, 'utf8') > MAX_CANONICAL_BYTES) {
    throw new GovernedActionError('INVALID_ARGUMENTS', `arguments exceed ${MAX_CANONICAL_BYTES} bytes`);
  }
  return out;
}

function serialize(value: unknown, depth: number, seen: Set<object>): string {
  if (depth > MAX_DEPTH) throw new GovernedActionError('INVALID_ARGUMENTS', 'arguments nest too deeply');
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new GovernedActionError('INVALID_ARGUMENTS', 'non-finite number');
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'object':
      break;
    default:
      throw new GovernedActionError('INVALID_ARGUMENTS', `unsupported JSON type: ${typeof value}`);
  }
  const obj = value as object;
  if (seen.has(obj)) throw new GovernedActionError('INVALID_ARGUMENTS', 'cyclic arguments');
  seen.add(obj);
  try {
    if (Array.isArray(obj)) {
      return `[${obj.map((item) => serialize(item, depth + 1, seen)).join(',')}]`;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      throw new GovernedActionError('INVALID_ARGUMENTS', 'arguments must be plain JSON objects');
    }
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key], depth + 1, seen)}`).join(',')}}`;
  } finally {
    seen.delete(obj);
  }
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Parse a canonical string back to an immutable JSON value. */
export function parseCanonical(canonical: string): JsonValue {
  return deepFreeze(JSON.parse(canonical) as JsonValue);
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/** Canonicalize + digest; also returns a frozen copy detached from caller references. */
export function freezeArguments(value: unknown): { arguments: JsonValue; canonical: string; digest: string } {
  const canonical = canonicalJson(value);
  return { arguments: parseCanonical(canonical), canonical, digest: sha256Hex(canonical) };
}

/**
 * Integrity check used at authorize and execute time: the stored arguments must still
 * serialize to the stored canonical form, and that form must still hash to the frozen digest.
 */
export function argumentsIntact(input: { arguments: JsonValue; canonicalArguments: string; argumentDigest: string }): boolean {
  try {
    return canonicalJson(input.arguments) === input.canonicalArguments &&
      sha256Hex(input.canonicalArguments) === input.argumentDigest;
  } catch {
    return false;
  }
}
