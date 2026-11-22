import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor, type OnModuleDestroy } from '@nestjs/common';
import { Observable } from 'rxjs';
import { HttpMetrics } from './http-metrics';
import type { JsonLogger } from './json-logger';
import {
  REQUEST_ID_HEADER, bindRequestContext, contextForRaw, createRequestContext, runWithRequestContext,
} from './request-context';

/** Minimal structural view of the Fastify objects used here (no direct fastify import). */
export interface HookRequest {
  readonly raw: object;
  readonly method: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly routeOptions?: { readonly url?: string };
}
export interface HookReply {
  readonly statusCode: number;
  header(name: string, value: string): unknown;
}
type Done = (err?: Error) => void;
export interface HookHost {
  addHook(name: 'onRequest', hook: (request: HookRequest, reply: HookReply, done: Done) => void): unknown;
  addHook(name: 'onResponse', hook: (request: HookRequest, reply: HookReply, done: Done) => void): unknown;
}

/** Route template only; raw URLs (path parameters, query strings) are never recorded. */
export function routeTemplate(request: HookRequest): string {
  const url = request.routeOptions?.url;
  return typeof url === 'string' && url.length ? url : '(unmatched)';
}

/**
 * Registers correlation + access-log + metrics hooks on the Fastify instance.
 * - onRequest: accept a canonical-UUID `x-request-id` or generate one; echo it on the reply;
 *   bind the context to the raw request and run the rest of the hook chain inside ALS.
 * - onResponse: one structured `http.request` line and bounded counters.
 */
export function registerHttpObservability(host: HookHost, logger: JsonLogger, metrics: HttpMetrics): void {
  host.addHook('onRequest', (request, reply, done) => {
    const ctx = createRequestContext(request.headers[REQUEST_ID_HEADER]);
    bindRequestContext(request.raw, ctx);
    reply.header(REQUEST_ID_HEADER, ctx.requestId);
    runWithRequestContext(ctx, () => done());
  });
  host.addHook('onResponse', (request, reply, done) => {
    try {
      const ctx = contextForRaw(request.raw);
      const route = routeTemplate(request);
      metrics.record(request.method, route, reply.statusCode);
      const durationMs = ctx ? Number(process.hrtime.bigint() - ctx.startedAt) / 1e6 : undefined;
      logger.event(reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'log', {
        event: 'http.request', requestId: ctx?.requestId, workspaceId: ctx?.workspaceId,
        method: request.method, route, status: reply.statusCode, durationMs,
      });
    } catch {
      // Observability must never fail a response.
    }
    done();
  });
}

/**
 * Re-enters the request's ALS context around the Nest handler. Body parsing is driven by
 * stream events, which do not inherit the onRequest context, so this restores it.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ raw?: object } | undefined>();
    const ctx = contextForRaw(request?.raw);
    if (!ctx) return next.handle();
    return new Observable((subscriber) => runWithRequestContext(ctx, () => next.handle().subscribe(subscriber)));
  }
}

/** Periodic `metrics.snapshot` log line (OBS_METRICS_LOG_INTERVAL_MS, default 60000; 0 disables). */
export class MetricsReporter implements OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly logger: JsonLogger, private readonly metrics: HttpMetrics) {}

  static intervalFrom(value: string | undefined): number {
    if (value === undefined || value.trim() === '') return 60_000;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 86_400_000 ? parsed : 60_000;
  }

  start(intervalMs: number): void {
    if (this.timer || intervalMs <= 0) return;
    this.timer = setInterval(() => this.report(intervalMs), intervalMs);
    this.timer.unref();
  }

  report(intervalMs: number): void {
    this.logger.event('log', { event: 'metrics.snapshot', intervalMs, ...this.metrics.snapshot() });
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
