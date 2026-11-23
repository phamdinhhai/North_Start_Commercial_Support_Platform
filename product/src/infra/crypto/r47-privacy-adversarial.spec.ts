import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createHmacContentDigester, InMemoryWorkspaceKeyring } from '../../ports/content-digester';
import { LeadExportService } from '../../application/pilot/lead-export.service';
import type { AuthContext } from '../../ports/auth';
import { JsonLogger } from '../observability/json-logger';
import { redactTelemetryPayload } from '../telemetry/telemetry.service';

describe('R4.7 independent adversarial privacy boundaries', () => {
  it('separates tenant and purpose even when an operator accidentally reuses key bytes and kid', () => {
    const ring = new InMemoryWorkspaceKeyring(), secret = randomBytes(32);
    ring.rotate('tenant-a', 'same', secret); ring.rotate('tenant-b', 'same', secret);
    const d = createHmacContentDigester(ring), original = d.digest('tenant-a', 'message', 'ok');
    expect(d.digest('tenant-b', 'message', 'ok').value).not.toBe(original.value);
    expect(d.matches('tenant-b', 'message', 'ok', original)).toBe(false);
    expect(d.matches('tenant-a', 'receipt', 'ok', original)).toBe(false);
    expect(d.matches('tenant-a', 'message', 'changed', original)).toBe(false);
    expect(d.matches('tenant-a', 'message', 'ok', { ...original, kid: 'lost' })).toBe('UNKNOWN');
    expect(() => d.matches('tenant-a', 'message', 'ok', { ...original, value: 'bad' })).toThrow('invalid_content_digest');
  });

  it('does not enumerate existence through export for lower roles or malformed ids', async () => {
    const exportLead = vi.fn().mockResolvedValue(undefined), svc = new LeadExportService({ exportLead });
    const ctx: AuthContext = { workspaceId: 'trusted', userId: 'operator', role: 'admin', isDemo: false };
    for (const role of ['sales', 'viewer', 'manager'] as const) {
      for (const id of ['bad', '00000000-0000-4000-8000-000000000001']) {
        await expect(svc.export({ ...ctx, role }, id)).rejects.toMatchObject({ status: 403 });
      }
    }
    expect(exportLead).not.toHaveBeenCalled();
    await expect(svc.export(ctx, "' OR true --")).rejects.toMatchObject({ status: 400 });
    expect(exportLead).not.toHaveBeenCalled();
    const id = '00000000-0000-4000-8000-000000000001';
    await expect(svc.export(ctx, id)).rejects.toMatchObject({ status: 404 });
    expect(exportLead).toHaveBeenCalledExactlyOnceWith('trusted', id, 'operator');
  });

  it('removes secrets carried in structured log fields and telemetry object keys, not only values', () => {
    const lines: string[] = [], logger = new JsonLogger(line => lines.push(line));
    const secret = 'synthetic-person@example.invalid';
    logger.event('error', { event: 'request.failed', authorization: secret, route: '/?token=' + secret,
      requests: { [secret]: 1 }, body: { safe: secret }, cookie: secret });
    logger.error(new Error(secret + '\n    at person@example.invalid'));
    const payload = redactTelemetryPayload({ [secret]: 'ok', details: ['ok', secret, { safe: secret }], nested: { constructor: secret } });
    expect(JSON.stringify({ lines, payload })).not.toContain(secret);
    expect(JSON.stringify({ lines, payload })).not.toContain('person@example.invalid');
    expect(payload.details).toEqual(['ok', '[REDACTED]', { safe: '[REDACTED]' }]);
    expect(JSON.parse(lines[0])).toMatchObject({ event: 'request.failed', requests: {} });
  });
});
