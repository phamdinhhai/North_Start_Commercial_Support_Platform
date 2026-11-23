import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';

/** Fabricated research schema, NOT a provider payload or production adapter. ADR-007. */
export interface FabricatedCommerceEvidence {
  readonly schema: 'fabricated-commerce-v1';
  readonly workspaceId: string;
  readonly provider: string;
  readonly accountId: string;
  readonly recordId: string;
  readonly orderId: string;
  readonly kind: 'order-created' | 'payment-confirmed' | 'refund-created' | 'refund-confirmed' | 'order-cancelled';
  readonly amount: string;
  readonly currency: string;
  readonly occurredAt: string | typeof UNKNOWN_SENTINEL;
  readonly observedAt: string;
  readonly timezone: string | typeof UNKNOWN_SENTINEL;
}

// Explicit limited fixture registry, not a universal cents assumption or provider contract.
const currencyScales: Readonly<Record<string, number>> = Object.freeze({ USD: 2, VND: 0, JPY: 0, KWD: 3 });
const kinds = new Set(['order-created', 'payment-confirmed', 'refund-created', 'refund-confirmed', 'order-cancelled']);

/** Exact string arithmetic; reject excess precision rather than silently rounding money. */
export function fixtureMoney(amount: string, currency: string): { units: number; scale: number } {
  if (!Object.hasOwn(currencyScales, currency)) throw new Error('unsupported_currency');
  const scale = currencyScales[currency];
  if (typeof amount !== 'string' || amount.length > 64 || !/^(0|[1-9]\d*)(\.\d+)?$/.test(amount)) {
    throw new Error('invalid_amount');
  }
  const [whole, fractional = ''] = amount.split('.');
  if (fractional.length > scale) throw new Error('unsupported_precision');
  const units = BigInt(whole + fractional.padEnd(scale, '0'));
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('unsafe_amount');
  return { units: Number(units), scale };
}

function instant(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

/** ADR-005/008: provider money evidence never becomes an outcome or attribution assertion. */
export function normalizeFabricatedCommerce(row: FabricatedCommerceEvidence) {
  if (!row || row.schema !== 'fabricated-commerce-v1' || !kinds.has(row.kind)) throw new Error('invalid_schema');
  for (const value of [row.workspaceId, row.provider, row.accountId, row.recordId, row.orderId]) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 256) throw new Error('invalid_identity');
  }
  if (!instant(row.observedAt) || (row.occurredAt !== UNKNOWN_SENTINEL && !instant(row.occurredAt))) {
    throw new Error('invalid_time');
  }
  if (row.timezone !== UNKNOWN_SENTINEL) {
    if (typeof row.timezone !== 'string' || row.timezone.trim().length === 0) throw new Error('invalid_timezone');
    try { new Intl.DateTimeFormat('en', { timeZone: row.timezone }); } catch { throw new Error('invalid_timezone'); }
  }
  const money = fixtureMoney(row.amount, row.currency);
  return Object.freeze({
    ...row, ...money,
    // Tuple identity prevents cross-account/workspace and lifecycle collapse. No text/name matching.
    evidenceKey: JSON.stringify([row.workspaceId, row.provider, row.accountId, row.recordId, row.kind]),
    isSynthetic: true as const,
    leadId: UNKNOWN_SENTINEL,
    acquisitionLineage: UNKNOWN_SENTINEL,
    revenueAttribution: UNKNOWN_SENTINEL,
    financialMeaning: 'provider-evidence-only' as const,
  });
}
