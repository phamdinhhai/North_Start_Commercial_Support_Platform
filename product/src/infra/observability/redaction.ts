import { WORKSPACE_ID, isValidRequestId } from './request-context';

/**
 * Allowlist redaction for structured operational logs.
 *
 * Nothing is copied into a log line unless its KEY is listed below and its VALUE passes the
 * key's validator. Unknown keys (authorization, cookie, token, body, email, phone, headers,
 * query, url, ...) are dropped without inspection. Free-text messages survive only from
 * reviewed contexts whose call sites log fixed literals; all other text is replaced by a
 * marker plus its byte length. This is deliberately not a denylist of "bad" patterns.
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose';
export const LOG_LEVELS: readonly LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

export type LogRecord = Record<string, string | number | boolean | readonly string[] | Record<string, number>>;

export const REDACTED_TEXT = '[REDACTED]';
const MAX_MESSAGE_BYTES = 300;
const MAX_STACK_FRAMES = 12;
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const IDENT = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const EVENT = /^[a-z][a-z0-9_.]{0,63}$/;
/** Route templates come from registered routes (`/v1/pilot/leads/:id`), never raw URLs. */
const ROUTE = /^(?:\/[A-Za-z0-9_.:*-]{0,64}){1,12}$|^\(unmatched\)$/;
const METRIC_KEY = /^[A-Z]{3,7} (?:\/[A-Za-z0-9_.:*-]{0,64}){1,12} [1-5]\d\d$|^[A-Z]{3,7} \(unmatched\) [1-5]\d\d$|^[a-z0-9_.]{1,64}$/;
/** Stack frames: "at fn (path:line:col)" — message lines (which may carry PII) are dropped. */
const STACK_FRAME = /^ {4}at [\w$.<>[\] /\\:()@-]{1,300}$/;

/**
 * Contexts whose free-text messages are reviewed fixed literals (Nest bootstrap/routing and
 * product call sites that interpolate only error class names). Adding a context requires a
 * privacy review of every log call in it. ExceptionsHandler is intentionally absent: it
 * logs arbitrary exception messages.
 */
export const TRUSTED_MESSAGE_CONTEXTS: ReadonlySet<string> = new Set([
  'NestFactory', 'InstanceLoader', 'RoutesResolver', 'RouterExplorer', 'NestApplication',
  'Bootstrap', 'AuthService', 'PostgresService',
]);

type Validator = (value: unknown) => LogRecord[string] | undefined;
const str = (pattern: RegExp): Validator => (v) => (typeof v === 'string' && pattern.test(v) ? v : undefined);
const int = (min: number, max: number): Validator => (v) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? v as number : undefined);

function counters(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, number> = {};
  let n = 0;
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (++n > 512) break;
    if (METRIC_KEY.test(key) && Number.isSafeInteger(count) && (count as number) >= 0) out[key] = count as number;
  }
  return out;
}

/** The complete set of structured keys that may appear in a log line. */
const FIELDS: Readonly<Record<string, Validator>> = {
  event: str(EVENT),
  requestId: (v) => (isValidRequestId(v) ? v : undefined),
  workspaceId: (v) => (typeof v === 'string' && WORKSPACE_ID.test(v) ? v : undefined),
  method: (v) => (typeof v === 'string' && METHODS.has(v) ? v : typeof v === 'string' ? 'OTHER' : undefined),
  route: str(ROUTE),
  status: int(100, 599),
  durationMs: (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 1000) / 1000 : undefined),
  errorName: str(IDENT),
  code: str(/^[A-Z][A-Z0-9_]{0,63}$/),
  intervalMs: int(0, 86_400_000),
  requests: counters,
  authFailures: counters,
  intakeRejections: counters,
  droppedSeries: int(0, Number.MAX_SAFE_INTEGER),
};

export const ALLOWED_FIELDS: readonly string[] = Object.keys(FIELDS);

/** Copy only allowlisted, validated fields from a structured object. */
export function pickAllowed(source: unknown): LogRecord {
  const out: LogRecord = {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return out;
  for (const [key, validate] of Object.entries(FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = validate((source as Record<string, unknown>)[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function sanitizeText(text: string): string {
  // Strip control characters (log injection) and bound the size.
  const flat = Array.from(text, (ch) => { const c = ch.codePointAt(0) ?? 0; return c < 32 || c === 127 || c === 8232 || c === 8233 ? ' ' : ch; }).join('');
  return Buffer.byteLength(flat, 'utf8') <= MAX_MESSAGE_BYTES ? flat : `${Buffer.from(flat, 'utf8').subarray(0, MAX_MESSAGE_BYTES).toString('utf8')}…`;
}

/** Free text is kept only for reviewed contexts; otherwise a marker plus byte size. */
export function messageFields(message: unknown, context: string | undefined): LogRecord {
  if (typeof message === 'string') {
    if (context && TRUSTED_MESSAGE_CONTEXTS.has(context)) return { msg: sanitizeText(message) };
    return { msg: REDACTED_TEXT, msgBytes: Buffer.byteLength(message, 'utf8') };
  }
  if (message instanceof Error) {
    const name = IDENT.test(message.name) ? message.name : 'Error';
    return { msg: REDACTED_TEXT, errorName: name };
  }
  if (message && typeof message === 'object') return pickAllowed(message);
  if (typeof message === 'number' || typeof message === 'boolean') return { msg: REDACTED_TEXT };
  return {};
}

/** Keep only well-formed stack frames; the first stack line repeats the (untrusted) message. */
export function stackFrames(stack: unknown): readonly string[] | undefined {
  if (typeof stack !== 'string') return undefined;
  const frames = stack.split('\n').filter((line) => STACK_FRAME.test(line)).slice(0, MAX_STACK_FRAMES).map((line) => line.trim());
  return frames.length ? frames : undefined;
}

export function contextName(value: unknown): string | undefined {
  return typeof value === 'string' && IDENT.test(value) ? value : undefined;
}
