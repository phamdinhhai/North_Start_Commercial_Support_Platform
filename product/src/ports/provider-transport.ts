/** ADR-007: offline synthetic rehearsal only; never register in an HTTP module. */
export interface OfflineConnection {
  readonly mode: 'offline-synthetic';
  readonly connectionId: string;
  readonly provider: 'pancake' | 'meta-page';
  readonly accountId: string;
}
export interface TransportPage {
  readonly items: readonly unknown[];
  /** Opaque provider cursor, never interpreted as a sequence or completeness proof. */
  readonly nextCursor: string | null;
  readonly gap: boolean;
}
export type TransportResponse =
  | { readonly status: 'page'; readonly page: unknown }
  | { readonly status: 'rate-limited'; readonly retryAfter?: string }
  | { readonly status: 'timeout' | 'provider-error' };
export interface TransportBounds {
  readonly maxAttempts: number;
  readonly maxItems: number;
  readonly maxElapsedMs: number;
  readonly requestTimeoutMs: number;
  readonly backoffMs: number;
}
export interface OfflineTransportPorts {
  /** Trusted local callbacks must terminate; only request has enforced deadline/cancellation. */
  readonly now: () => number;
  readonly sleep: (milliseconds: number) => Promise<void>;
  /** Server-owned binding and revocation check, never a field in a client JSON payload. */
  readonly isAuthorized: (connection: OfflineConnection) => Promise<boolean>;
  readonly request: (connection: OfflineConnection, cursor: string | null, signal: AbortSignal) => Promise<TransportResponse>;
  /** Validate/normalize separately; must not infer commercial semantics. */
  readonly validate: (input: unknown) => TransportPage;
  /** Atomic durable receipts/dedupe + checkpoint contract. Replays must be idempotent. */
  readonly processAndCheckpoint: (connection: OfflineConnection, page: TransportPage) => Promise<void>;
  readonly acknowledge: () => Promise<void>;
}
export type TransportStatus = 'complete' | 'bounded' | 'revoked' | 'schema-poison' | 'gap' |
  'persistence-failed' | 'ack-failed' | 'provider-error' | 'invalid-configuration';
export interface TransportResult {
  readonly status: TransportStatus;
  readonly attempts: number;
  readonly items: number;
  readonly checkpoint: string | null;
  readonly completeness: 'UNKNOWN';
}
