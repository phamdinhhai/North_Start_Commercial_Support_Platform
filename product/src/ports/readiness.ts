export interface ReadinessResponse {
  status: 'ok' | 'not_ready';
  version: string;
  timestamp: string;
  checks: {
    store: { status: 'ok' | 'not_ready'; mode: 'postgres' | 'memory' | null; durable: boolean };
    database: { status: 'ok' | 'not_ready' | 'not_applicable'; latencyMs?: number };
    migrations: { status: 'ok' | 'not_ready' | 'not_applicable' };
  };
}

export interface ReadinessProbe {
  readiness(): Promise<ReadinessResponse>;
}

export const READINESS_PROBE = Symbol('READINESS_PROBE');
