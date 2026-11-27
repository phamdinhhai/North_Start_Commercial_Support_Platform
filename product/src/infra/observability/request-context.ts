import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { RequestAnnotator } from '../../ports/request-context';

/**
 * Per-request correlation context propagated with AsyncLocalStorage.
 * Only server-generated or strictly validated values are stored here.
 */
export interface RequestContext {
  readonly requestId: string;
  readonly startedAt: bigint;
  workspaceId?: string;
}

/** Canonical UUID only: no free text (and therefore no PII) can ride in on the header. */
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Same workspace identifier vocabulary as the telemetry boundary. Free-form identifiers
 * (which could be a phone number or e-mail chosen by a caller) are never logged.
 */
export const WORKSPACE_ID = /^(?:ws-[a-z0-9_-]{1,30}|bootstrap|demo:[a-z0-9_-]{1,30}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const REQUEST_ID_HEADER = 'x-request-id';

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID.test(value);
}

/** Accept an inbound id only when it is a single canonical UUID; otherwise generate one. */
export function resolveRequestId(inbound: unknown, generate: () => string = randomUUID): string {
  return isValidRequestId(inbound) ? inbound.toLowerCase() : generate();
}

const storage = new AsyncLocalStorage<RequestContext>();
/** Keyed by the raw Node request so Fastify hooks and Nest handlers share one context. */
const byRawRequest = new WeakMap<object, RequestContext>();

export function createRequestContext(inbound: unknown): RequestContext {
  return { requestId: resolveRequestId(inbound), startedAt: process.hrtime.bigint() };
}

export function bindRequestContext(raw: object, ctx: RequestContext): void {
  byRawRequest.set(raw, ctx);
}

export function contextForRaw(raw: object | undefined): RequestContext | undefined {
  return raw ? byRawRequest.get(raw) : undefined;
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Adapter for the REQUEST_ANNOTATOR port. Invalid identifiers are silently not logged. */
export class AlsRequestAnnotator implements RequestAnnotator {
  annotateWorkspace(workspaceId: string): void {
    const ctx = currentRequestContext();
    if (ctx && typeof workspaceId === 'string' && WORKSPACE_ID.test(workspaceId)) ctx.workspaceId = workspaceId;
  }
}
