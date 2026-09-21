import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('GET /health returns 200 shape', () => {
    const res = controller.health();
    expect(res.status).toBe('ok');
    expect(typeof res.timestamp).toBe('string');
    expect(new Date(res.timestamp).getTime()).not.toBeNaN();
  });

  it('timestamp is ISO 8601', () => {
    const { timestamp } = controller.health();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('version is a string', () => {
    const { version } = controller.health();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });
});
