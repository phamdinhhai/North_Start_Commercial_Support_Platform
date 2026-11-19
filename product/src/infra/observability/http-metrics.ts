/**
 * In-process HTTP counters. Labels are bounded: HTTP method (allowlisted), the registered
 * route TEMPLATE (never the raw URL, IDs or query) and the status code. Unmatched paths
 * collapse into "(unmatched)". A hard series cap protects memory; overflow is counted.
 *
 * Exposure decision: counters are process-wide and therefore cross-tenant aggregates. They
 * are NOT served over HTTP (no workspace-scoped principal may see other tenants' volume and
 * the only admin principal today is the PM-1 bootstrap stub). They are emitted as a periodic
 * `metrics.snapshot` structured log line for the operator log pipeline instead.
 */
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const INTAKE_ROUTE = /^\/v1\/integration\/(?:enroll|revoke|observations)$/;
const INTAKE_STATUSES = new Set([409, 413, 503]);
export const MAX_SERIES = 256;

export interface MetricsSnapshot {
  readonly requests: Record<string, number>;
  readonly authFailures: Record<string, number>;
  readonly intakeRejections: Record<string, number>;
  readonly droppedSeries: number;
}

export class HttpMetrics {
  private readonly requests = new Map<string, number>();
  private readonly authFailures = new Map<string, number>();
  private readonly intakeRejections = new Map<string, number>();
  private dropped = 0;

  record(method: string, route: string, status: number): void {
    const m = METHODS.has(method) ? method : 'OTHER';
    const r = route || '(unmatched)';
    const s = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 500;
    this.increment(this.requests, `${m} ${r} ${s}`);
    if (s === 401 || s === 403) this.increment(this.authFailures, `${m} ${r} ${s}`);
    if (INTAKE_STATUSES.has(s) && INTAKE_ROUTE.test(r)) this.increment(this.intakeRejections, `${m} ${r} ${s}`);
  }

  snapshot(): MetricsSnapshot {
    return {
      requests: Object.fromEntries(this.requests),
      authFailures: Object.fromEntries(this.authFailures),
      intakeRejections: Object.fromEntries(this.intakeRejections),
      droppedSeries: this.dropped,
    };
  }

  private increment(map: Map<string, number>, key: string): void {
    const current = map.get(key);
    if (current === undefined && map.size >= MAX_SERIES) {
      this.dropped++;
      return;
    }
    map.set(key, (current ?? 0) + 1);
  }
}
