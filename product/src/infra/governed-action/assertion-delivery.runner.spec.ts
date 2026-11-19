import { describe, expect, it } from 'vitest';
import { deliveryEnabled } from './assertion-delivery.runner';
describe('assertion delivery foundation switch', () => {
  it('defaults off and cannot enable production/pilot or memory delivery', () => {
    expect(deliveryEnabled({})).toBe(false);
    expect(deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'false' })).toBe(false);
    expect(() => deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'yes' })).toThrow();
    for (const mode of ['production', 'pilot']) expect(() => deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: mode })).toThrow('RESEARCH_ONLY');
    expect(() => deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory' })).toThrow('RESEARCH_ONLY');
    expect(deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'postgres', DATABASE_URL: 'postgresql://127.0.0.1/disposable' })).toBe(true);
    expect(() => deliveryEnabled({ ASSERTION_DELIVERY_ENABLED: 'true', NODE_ENV: 'production', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'postgres', DATABASE_URL: 'postgresql://127.0.0.1/disposable' })).toThrow('RESEARCH_ONLY');
  });
});
