import { describe, it, expect } from 'vitest';
import { hasPostgresConfiguration, resolveDeploymentMode, resolvePilotStoreMode, resolvePoolConfig } from './postgres.service';

describe('deployment and persistence configuration', () => {
  it('selects PostgreSQL for local with DATABASE_URL or POSTGRES_* (legacy durability)', () => {
    expect(resolveDeploymentMode({})).toBe('local');
    expect(resolvePilotStoreMode({ DATABASE_URL: 'postgres://db/app' })).toBe('postgres');
    expect(resolvePilotStoreMode({ POSTGRES_DB: 'north_star' })).toBe('postgres');
    expect(resolvePilotStoreMode({ POSTGRES_HOST: 'db' })).toBe('postgres');
    expect(resolvePilotStoreMode({ POSTGRES_PORT: '5432' })).toBe('postgres');
    expect(resolvePilotStoreMode({ POSTGRES_PASSWORD: 'provided' })).toBe('postgres');
    expect(hasPostgresConfiguration({})).toBe(false);
  });

  it('requires PostgreSQL configuration for pilot, production and explicit postgres mode', () => {
    for (const deployment of ['pilot', 'production']) {
      expect(() => resolvePilotStoreMode({ DEPLOYMENT_MODE: deployment })).toThrow('PostgreSQL is not configured');
      expect(resolvePilotStoreMode({ DEPLOYMENT_MODE: deployment, POSTGRES_USER: 'north_star' })).toBe('postgres');
    }
    expect(() => resolvePilotStoreMode({ PILOT_STORE_MODE: 'postgres' })).toThrow('PostgreSQL is not configured');
  });

  it('allows explicit memory only for local-compatible modes, overriding DB settings', () => {
    for (const deployment of ['local', 'demo', 'test']) {
      expect(resolvePilotStoreMode({ DEPLOYMENT_MODE: deployment, PILOT_STORE_MODE: 'memory' })).toBe('memory');
    }
    expect(resolvePilotStoreMode({ DATABASE_URL: 'postgres://db/app', PILOT_STORE_MODE: 'memory' })).toBe('memory');
    expect(() => resolvePilotStoreMode({ DEPLOYMENT_MODE: 'pilot', PILOT_STORE_MODE: 'memory' })).toThrow(
      'In-memory pilot store is not allowed in pilot mode',
    );
    expect(() => resolvePilotStoreMode({ DEPLOYMENT_MODE: 'production', PILOT_STORE_MODE: 'memory' })).toThrow();
    expect(() => resolvePilotStoreMode({})).toThrow('Select PILOT_STORE_MODE=memory');
  });

  it('prefers DATABASE_URL and otherwise normalizes POSTGRES settings', () => {
    expect(resolvePoolConfig({ DATABASE_URL: 'postgres://db/app' })?.connectionString).toBe('postgres://db/app');
    expect(resolvePoolConfig({ POSTGRES_HOST: 'db', POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p@ss', POSTGRES_DB: 'd' })?.connectionString)
      .toBe('postgres://u:p%40ss@db:5432/d');
    expect(resolvePoolConfig({})).toBeUndefined();
  });
});
