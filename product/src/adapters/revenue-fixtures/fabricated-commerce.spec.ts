import { describe, expect, it } from 'vitest';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import { fixtureMoney, normalizeFabricatedCommerce, type FabricatedCommerceEvidence } from './fabricated-commerce';

const evidence: FabricatedCommerceEvidence = {
  schema: 'fabricated-commerce-v1', workspaceId: 'fabricated-workspace', provider: 'fabricated-provider',
  accountId: 'account-a', recordId: 'record-a', orderId: 'order-a', kind: 'order-created',
  amount: '10.25', currency: 'USD', occurredAt: UNKNOWN_SENTINEL,
  observedAt: '2026-11-20T00:00:00.000Z', timezone: UNKNOWN_SENTINEL,
};

describe('fabricated commerce evidence (no provider payload claims)', () => {
  it.each([['0.01', 'USD', 1, 2], ['10000', 'VND', 10000, 0], ['123', 'JPY', 123, 0], ['1.001', 'KWD', 1001, 3]])(
    'scales %s %s exactly', (amount, currency, units, scale) => {
      expect(fixtureMoney(amount as string, currency as string)).toEqual({ units, scale });
    },
  );
  it.each(['1.001', '1.000', '-1', '1e2', 'NaN', 'Infinity', ' 1', '01', '1.', '1,000'])('rejects USD %s without rounding', amount => {
    expect(() => fixtureMoney(amount, 'USD')).toThrow();
  });
  it('rejects numeric inputs, unsupported currencies and unsafe exact integers', () => {
    expect(() => fixtureMoney(0.1 as unknown as string, 'USD')).toThrow('invalid_amount');
    expect(() => fixtureMoney('1', 'EUR')).toThrow('unsupported_currency');
    expect(() => fixtureMoney('1', UNKNOWN_SENTINEL)).toThrow('unsupported_currency');
    expect(() => fixtureMoney('1.0', 'JPY')).toThrow('unsupported_precision');
    expect(fixtureMoney('90071992547409.91', 'USD').units).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => fixtureMoney('90071992547409.92', 'USD')).toThrow('unsafe_amount');
  });
  it('preserves lifecycle and partial refunds without computing net or verified revenue', () => {
    const rows = (['order-created', 'payment-confirmed', 'refund-created', 'refund-confirmed', 'order-cancelled'] as const)
      .map(kind => normalizeFabricatedCommerce({ ...evidence, kind, amount: kind.startsWith('refund') ? '2.01' : '10.25' }));
    expect(new Set(rows.map(row => row.evidenceKey)).size).toBe(5);
    expect(rows[2].units).toBe(201);
    for (const row of rows) {
      expect(row.leadId).toBe(UNKNOWN_SENTINEL);
      expect(row.revenueAttribution).toBe(UNKNOWN_SENTINEL);
      expect(row).not.toHaveProperty('verifiedRevenue');
      expect(row).not.toHaveProperty('outcome');
    }
  });
  it('preserves unknown time/zone, isolates accounts and does not mutate evidence', () => {
    const raw = Object.freeze({ ...evidence });
    const normalized = normalizeFabricatedCommerce(raw);
    expect(normalized.occurredAt).toBe(UNKNOWN_SENTINEL);
    expect(normalized.timezone).toBe(UNKNOWN_SENTINEL);
    expect(normalized.amount).toBe('10.25');
    expect(normalizeFabricatedCommerce({ ...raw, accountId: 'account-b' }).evidenceKey).not.toBe(normalized.evidenceKey);
    expect(normalizeFabricatedCommerce({ ...raw, workspaceId: 'workspace-b' }).evidenceKey).not.toBe(normalized.evidenceKey);
  });
  it.each(['2026-02-30T00:00:00.000Z', '2026-11-20', '2026-11-20T00:00:00', 'invalid'])('rejects ambiguous/invalid time %s', occurredAt => {
    expect(() => normalizeFabricatedCommerce({ ...evidence, occurredAt })).toThrow('invalid_time');
  });
  it('validates schema, identity, observation time and timezone', () => {
    expect(() => normalizeFabricatedCommerce({ ...evidence, accountId: '' })).toThrow('invalid_identity');
    expect(() => normalizeFabricatedCommerce({ ...evidence, schema: 'provider-v1' } as never)).toThrow('invalid_schema');
    expect(() => normalizeFabricatedCommerce({ ...evidence, observedAt: UNKNOWN_SENTINEL })).toThrow('invalid_time');
    expect(() => normalizeFabricatedCommerce({ ...evidence, timezone: 'nonsense' })).toThrow('invalid_timezone');
    expect(normalizeFabricatedCommerce({ ...evidence, timezone: 'Asia/Ho_Chi_Minh' }).timezone).toBe('Asia/Ho_Chi_Minh');
  });
});
