import { describe, expect, it } from 'vitest';
import { syntheticSourceMode } from './synthetic-source-mode';
describe('synthetic source enablement', () => {
  const allowed = { SOURCE_INTEGRATION_SYNTHETIC_ENABLED: 'true', DEPLOYMENT_MODE: 'test', AUTH_MODE: 'oidc', PILOT_STORE_MODE: 'postgres', NODE_ENV: 'test' };
  it('is off by default and never changes pilot configuration', () => {
    expect(syntheticSourceMode({})).toBe(false);
    expect(syntheticSourceMode({ ...allowed, SOURCE_INTEGRATION_SYNTHETIC_ENABLED: 'false' })).toBe(false);
    expect(syntheticSourceMode(allowed)).toBe(true);
  });
  it.each([{ DEPLOYMENT_MODE: 'pilot' }, { DEPLOYMENT_MODE: 'production' }, { NODE_ENV: 'production' },
    { AUTH_MODE: 'legacy' }, { PILOT_STORE_MODE: 'memory' }, { SOURCE_INTEGRATION_SYNTHETIC_ENABLED: 'TRUE' }])('refuses unsafe bootstrap %j', patch => {
      expect(() => syntheticSourceMode({ ...allowed, ...patch })).toThrow('SOURCE_SYNTHETIC_CONFIGURATION_INVALID');
    });
});
