import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PosWebhookFixtureReceiver } from './pos-webhook-fixture';
import type { ResearchReceipt } from '../../ports/research-receipt.port';
import { testDigester } from './digest-test-support';

const scope = { workspaceId: 'fixture-workspace', connectionId: 'fixture-connection', accountId: 'fixture-shop', providerSurface: 'pancake-pos' as const };
const secret = 'synthetic-only-never-provider-secret';
const options = { digester: testDigester(), researchCapture: { enabled: true as const, authorizedWorkspaceId: scope.workspaceId, retentionDays: 7 } };
const delivery = { configuredSecretHeader: secret, receiptId: 'local-delivery-1', receivedAt: '2026-11-14T00:00:00.000Z',
  // Documented WebhookProductResponse subset, entirely synthetic.
  rawBody: Buffer.from('{"data":{"success":true,"record":{"name":"Synthetic product","weight":0}}}') };

describe('synthetic POS intake assurance', () => {
  it('does not acknowledge before the sink confirms persistence', async () => {
    let confirm!: (value: 'stored') => void;
    const append = vi.fn((_record: ResearchReceipt) => new Promise<'stored'>((done) => { confirm = done; }));
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append }, options);
    let acknowledged = false;
    const pending = receiver.receive(delivery).then((value) => { acknowledged = true; return value; });
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    confirm('stored');
    expect(await pending).toEqual({ status: 202, result: 'stored' });
    const saved: ResearchReceipt = append.mock.calls[0][0];
    expect(saved).toMatchObject({
      evidenceType: 'synthetic',
      schemaStatus: 'uninterpreted',
      workspaceId: scope.workspaceId,
      retentionDays: 7,
      payloadDigest: { alg: 'HMAC-SHA256' },
    });
    expect(Buffer.from(saved.rawBodyBase64!, 'base64')).toEqual(delivery.rawBody);
    expect(Buffer.from(saved.rawBody!)).toEqual(delivery.rawBody);
  });

  it.each(['duplicate', 'conflict', 'UNKNOWN'] as const)('maps atomic sink result %s', async (result) => {
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append: async () => result }, options);
    const expected = result === 'duplicate'
      ? { status: 202, result: 'duplicate' }
      : result === 'conflict'
        ? { status: 409, result: 'conflict' }
        : { status: 503, result: 'UNKNOWN' };
    expect(await receiver.receive(delivery)).toEqual(expected);
  });

  it('returns retryable failure without exposing storage errors or credentials', async () => {
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append: async () => { throw new Error('sensitive-error'); } }, options);
    expect(await receiver.receive(delivery)).toEqual({ status: 503, result: 'persistence_unconfirmed' });
  });

  it.each([undefined, ['two', 'headers'], 'wrong-secret', 'x'.repeat(1025)])('rejects missing, duplicated or incorrect source headers', async (header) => {
    const append = vi.fn();
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append }, options);
    expect((await receiver.receive({ ...delivery, configuredSecretHeader: header })).status).toBe(401);
    expect(append).not.toHaveBeenCalled();
  });

  it.each([Buffer.from('[]'), Buffer.from('null'), Buffer.from('not json'), Buffer.from([0xff])])('rejects malformed content before storage', async (rawBody) => {
    const append = vi.fn();
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append }, options);
    expect((await receiver.receive({ ...delivery, rawBody })).status).toBe(400);
    expect(append).not.toHaveBeenCalled();
  });

  it('limits raw bodies and validates receipt metadata', async () => {
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append: vi.fn() }, options);
    expect((await receiver.receive({ ...delivery, rawBody: Buffer.alloc(262145) })).status).toBe(413);
    expect((await receiver.receive({ ...delivery, receiptId: '' })).status).toBe(400);
  });

  it('binds tenant identity to configuration, never to payload fields', async () => {
    const append = vi.fn(async (_record: ResearchReceipt) => 'stored' as const);
    const receiver = new PosWebhookFixtureReceiver(scope, secret, { append }, options);
    await receiver.receive({ ...delivery, rawBody: Buffer.from('{"workspaceId":"other"}') });
    expect(append.mock.calls[0][0].workspaceId).toBe(scope.workspaceId);
    expect(() => new PosWebhookFixtureReceiver({ ...scope, providerSurface: 'pancake-conversations' }, secret, { append }, options)).toThrow('unsupported_surface');
    expect(() => new PosWebhookFixtureReceiver(scope, '', { append }, options)).toThrow('invalid_fixture_secret');
  });
});

describe('ADR-009 research raw-body capture', () => {
  it.each([
    ['no flag', undefined],
    ['flag not enabled', { enabled: false, authorizedWorkspaceId: scope.workspaceId, retentionDays: 7 }],
    ['another workspace', { enabled: true, authorizedWorkspaceId: 'other-workspace', retentionDays: 7 }],
    ['retention above 7 days', { enabled: true, authorizedWorkspaceId: scope.workspaceId, retentionDays: 8 }],
    ['zero retention', { enabled: true, authorizedWorkspaceId: scope.workspaceId, retentionDays: 0 }],
  ])('refuses to retain raw bodies without an explicit bounded grant: %s', (_name, researchCapture) => {
    expect(() => new PosWebhookFixtureReceiver(scope, secret, { append: vi.fn() }, { digester: options.digester, researchCapture } as never))
      .toThrow('research_capture_not_authorized');
    expect(() => new PosWebhookFixtureReceiver(scope, secret, { append: vi.fn() }, { researchCapture: options.researchCapture } as never)).toThrow('digester_required');
  });

  it('records a keyed receipt digest with its kid, never the unkeyed sha256 of the body', async () => {
    const append = vi.fn(async (_record: ResearchReceipt) => 'stored' as const);
    await new PosWebhookFixtureReceiver(scope, secret, { append }, options).receive(delivery);
    const saved = append.mock.calls[0][0];
    expect(saved.payloadHash).toMatch(/^hmac-sha256:[A-Za-z0-9._:-]+:[a-f0-9]{64}$/);
    expect(saved.payloadHash).not.toContain(createHash('sha256').update(delivery.rawBody).digest('hex'));
    const other = vi.fn(async (_record: ResearchReceipt) => 'stored' as const);
    const otherScope = { ...scope, workspaceId: 'fixture-workspace-b' };
    await new PosWebhookFixtureReceiver(otherScope, secret, { append: other }, { ...options, researchCapture: { ...options.researchCapture, authorizedWorkspaceId: otherScope.workspaceId } }).receive(delivery);
    expect(other.mock.calls[0][0].payloadHash.split(':')[2]).not.toBe(saved.payloadHash.split(':')[2]);
  });
});
