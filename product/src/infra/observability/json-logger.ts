import type { LoggerService } from '@nestjs/common';
import { currentRequestContext } from './request-context';
import {
  LOG_LEVELS, contextName, messageFields, pickAllowed, stackFrames, type LogLevel, type LogRecord,
} from './redaction';

export type LogSink = (line: string) => void;

const stdoutSink: LogSink = (line) => { process.stdout.write(`${line}\n`); };

/** LOG_LEVEL=<level> keeps that level and everything more severe; LOG_LEVEL=silent disables output. */
export function resolveLogLevels(value: string | undefined): ReadonlySet<LogLevel> {
  const wanted = (value ?? 'log').trim().toLowerCase();
  if (wanted === 'silent') return new Set();
  const index = LOG_LEVELS.indexOf(wanted as LogLevel);
  return new Set(LOG_LEVELS.slice(0, index < 0 ? LOG_LEVELS.indexOf('log') + 1 : index + 1));
}

/**
 * Structured JSON-lines logger implementing Nest's LoggerService.
 * Every line carries level, ts and — inside a request — the correlation requestId and the
 * server-resolved workspaceId (when annotated). Content is allowlist-redacted (redaction.ts).
 * Operational telemetry only: never written to commercial tables or presented as evidence.
 */
export class JsonLogger implements LoggerService {
  private levels: ReadonlySet<LogLevel>;

  constructor(
    private readonly sink: LogSink = stdoutSink,
    levels: ReadonlySet<LogLevel> = resolveLogLevels(process.env.LOG_LEVEL),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.levels = levels;
  }

  setLogLevels(levels: LogLevel[]): void {
    this.levels = new Set(levels.filter((level) => LOG_LEVELS.includes(level)));
  }

  log(message: unknown, ...params: unknown[]): void { this.write('log', message, params); }
  warn(message: unknown, ...params: unknown[]): void { this.write('warn', message, params); }
  debug(message: unknown, ...params: unknown[]): void { this.write('debug', message, params); }
  verbose(message: unknown, ...params: unknown[]): void { this.write('verbose', message, params); }
  fatal(message: unknown, ...params: unknown[]): void { this.write('fatal', message, params, true); }
  error(message: unknown, ...params: unknown[]): void { this.write('error', message, params, true); }

  /** Emit a structured event; only allowlisted fields of `fields` survive. */
  event(level: LogLevel, fields: Record<string, unknown>): void {
    if (!this.levels.has(level)) return;
    this.emit(level, pickAllowed(fields), undefined);
  }

  private write(level: LogLevel, message: unknown, params: unknown[], errorLike = false): void {
    if (!this.levels.has(level)) return;
    const rest = [...params];
    // Nest convention: the trailing string parameter is the logger context.
    const context = rest.length && typeof rest[rest.length - 1] === 'string' ? contextName(rest.pop()) : undefined;
    const record: LogRecord = { ...messageFields(message, context) };
    if (errorLike) {
      const stack = message instanceof Error ? message.stack : rest.find((p) => typeof p === 'string');
      const frames = stackFrames(stack);
      if (frames) record.stack = frames;
    }
    this.emit(level, record, context);
  }

  private emit(level: LogLevel, record: LogRecord, context: string | undefined): void {
    const ctx = currentRequestContext();
    const line: LogRecord = { level, ts: this.now().toISOString() };
    if (context) line.context = context;
    if (ctx) {
      line.requestId = ctx.requestId;
      if (ctx.workspaceId) line.workspaceId = ctx.workspaceId;
    }
    // Explicit, already-validated record fields win only for keys not set from the context.
    for (const [key, value] of Object.entries(record)) if (!(key in line)) line[key] = value;
    try {
      this.sink(JSON.stringify(line));
    } catch {
      // Logging must never break request handling.
    }
  }
}
