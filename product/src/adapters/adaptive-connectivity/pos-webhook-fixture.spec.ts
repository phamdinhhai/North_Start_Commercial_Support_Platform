import { describe, expect, it, vi } from 'vitest';
import { PosWebhookFixtureReceiver } from './pos-webhook-fixture';
import type { ResearchReceipt } from '../../ports/research-receipt.port';

const scope = { workspaceId: 'fixture-workspace', connectionId: 'fixture-connection', accountId: 'fixture-shop', providerSurface: 'pancake-pos' as const };
const secret = 'synthetic-only-never-provider-secret';
const delivery = { configuredSecretHeader: secret, receiptId: 'local-delivery-1', receivedAt: '2026-11-14T00:00:00.000Z',
  // Documented WebhookProductResponse subset, entirely synthetic.
  rawBody: Buffer.from('{"data":{"success":true,"record":{"name":"Synthetic product","weight":0}}}') };

describe('synthetic POS intake assurance', () => {
  it('does not acknowledge before the sink confirms persistence', async () => {
    let confirm!: (value: 'stored') => void;
    const append = vi.fn((_record: ResearchReceipt) => new Promise<'stored'>((done) => { confirm = done; }));
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append });
    let acknowledged = false;
    const pending = receiver.receive(delivery).then((value) => { acknowledged = true; return value; });
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    confirm('stored');
    expect(await pending).toEqual({ status: 202, result: 'stored' });
    const saved: ResearchReceipt = append.mock.calls[0][0];
    expect(saved).toMatchObject({ evidenceType: 'synthetic', schemaStatus: 'uninterpreted', workspaceId: scope.workspaceId });
    expect(Buffer.from(saved.rawBodyBase64, 'base64')).toEqual(delivery.rawBody);
  });

  it.each(['duplicate', 'conflict'] as const)('maps atomic sink result %s', async (result) => {
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append: async () => result });
    expect((await receiver.receive(delivery)).status).toBe(result === 'duplicate' ? 202 : 409);
  });

  it('returns retryable failure without exposing storage errors or credentials', async () => {
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append: async () => { throw new Error('sensitive-error'); } });
    expect(await receiver.receive(delivery)).toEqual({ status: 503, result: 'persistence_unconfirmed' });
  });

  it.each([undefined, ['two', 'headers'], 'wrong-secret', 'x'.repeat(1025)])('rejects missing, duplicated or incorrect source headers', async (header) => {
    const append = vi.fn();
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append });
    expect((await receiver.receive({ ...delivery, configuredSecretHeader: header })).status).toBe(401);
    expect(append).not.toHaveBeenCalled();
  });

  it.each([Buffer.from('[]'), Buffer.from('null'), Buffer.from('not json'), Buffer.from([0xff])])('rejects malformed content before storage', async (rawBody) => {
    const append = vi.fn();
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append });
    expect((await receiver.receive({ ...delivery, rawBody })).status).toBe(400);
    expect(append).not.toHaveBeenCalled();
  });

  it('limits raw bodies and validates receipt metadata', async () => {
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append: vi.fn() });
    expect((await receiver.receive({ ...delivery, rawBody: Buffer.alloc(262145) })).status).toBe(413);
    expect((await receiver.receive({ ...delivery, receiptId: '' })).status).toBe(400);
  });

  it('binds tenant identity to configuration, never to payload fields', async () => {
    const append = vi.fn(async (_record: ResearchReceipt) => 'stored' as const);
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append });
    await receiver.receive({ ...delivery, rawBody: Buffer.from('{"workspaceId":"other"}') });
    expect(append.mock.calls[0][0].workspaceId).toBe(scope.workspaceId);
    expect(() => new PosWebhookFixtureReceiver({ ...scope, providerSurface: 'pancake-conversations' }, secret, { append })).toThrow('unsupported_surface');
    expect(() => new PosWebhookFixtureReceiver(scope, '', { append })).toThrow('invalid_fixture_secret');
  });
});
