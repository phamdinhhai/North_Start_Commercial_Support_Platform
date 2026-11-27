import { describe, expect, it, vi } from 'vitest';
import { AssertionDeliveryRunner, deliveryEnabled } from './assertion-delivery.runner';
import type { PostgresService } from '../postgres/postgres.service';

describe('assertion delivery foundation switch and non-overlapping runner', () => {
  it('defaults off and cannot enable production/pilot or memory delivery', () => {
    expect(deliveryEnabled({})).toBe(false);
    expect(deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'false' })).toBe(false);
    expect(() => deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'yes' })).toThrow();
    for (const mode of ['production', 'pilot']) expect(() => deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: mode })).toThrow('RESEARCH_ONLY');
    expect(() => deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory' })).toThrow('RESEARCH_ONLY');
    expect(deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'postgres', DATABASE_URL: 'postgresql://127.0.0.1/disposable' })).toBe(true);
    expect(() => deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'true', NODE_ENV: 'production', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'postgres', DATABASE_URL: 'postgresql://127.0.0.1/disposable' })).toThrow('RESEARCH_ONLY');
  });

  it('does not schedule timers when disabled, and awaits in-flight pass without overlapping on destroy when enabled', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const disabled = new AssertionDeliveryRunner({ query } as unknown as PostgresService);
    disabled.onModuleInit();
    await disabled.onModuleDestroy();
    expect(query).not.toHaveBeenCalled();

    const original = { ...process.env };
    Object.assign(process.env, { ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'postgres', DATABASE_URL: 'postgresql://127.0.0.1/disposable' });
    try {
      let release!: () => void;
      const slowQuery = vi.fn().mockImplementationOnce(() => new Promise((r) => { release = () => r({ rows: [], rowCount: 0 }); }))
        .mockResolvedValue({ rows: [], rowCount: 0 });
      const runner = new AssertionDeliveryRunner({ query: slowQuery } as unknown as PostgresService);
      (runner as unknown as { tick: () => void }).tick();
      (runner as unknown as { tick: () => void }).tick();
      expect(slowQuery).toHaveBeenCalledTimes(1);
      const stopping = runner.onModuleDestroy();
      release();
      await stopping;
    } finally {
      process.env = original;
    }
  });
});
