import { describe, expect, it } from 'vitest';
import { normalizeChannelCapabilities } from './channel-capability.normalizer';

describe('normalizeChannelCapabilities', () => {
  it('retains official transport, provider capability, webhook schema/version and boundaries', () => {
    expect(normalizeChannelCapabilities({
      channel: 'chatwoot', transport: 'official', providerCapability: 'conversation.assignment',
      conversation: true, contact: true, assignment: true, handoff: 'not_observed', inbound: true, outbound: true,
      humanBoundary: true, agentBoundary: false,
      webhook: { inbound: true, retry: 'unknown', audit: 'not_requested', schema: 'chatwoot.webhook', version: 'v3' },
    })).toEqual({
      channel: 'chatwoot', transport: 'official', providerCapability: 'conversation.assignment',
      conversation: true, contact: true, assignment: true, handoff: 'not_observed', inbound: true, outbound: true,
      humanBoundary: true, agentBoundary: false,
      webhook: { inbound: true, retry: 'unknown', audit: 'not_requested', schema: 'chatwoot.webhook', version: 'v3' },
      limitations: [],
    });
  });

  it.each([
    ['zalo-bridge', 'unofficial'], ['wa-private', 'unofficial'], ['pancake', 'official'],
  ] as const)('retains %s transport status without upgrading support', (channel, transport) => {
    const result = normalizeChannelCapabilities({ channel, transport, providerCapability: 'message.send', outbound: true });
    expect(result.channel).toBe(channel);
    expect(result.transport).toBe(transport);
    expect(result.outbound).toBe(true);
    expect(result.inbound).toBe('unknown');
  });

  it('does not infer false from missing or malformed evidence', () => {
    const result = normalizeChannelCapabilities({
      channel: 'zca-bridge', transport: 'not_observed', providerCapability: 'unsupported', contact: 'yes' as never,
      webhook: { inbound: false },
    });
    expect(result.conversation).toBe('unknown');
    expect(result.contact).toBe('unknown');
    expect(result.assignment).toBe('unknown');
    expect(result.handoff).toBe('unknown');
    expect(result.inbound).toBe('unknown');
    expect(result.outbound).toBe('unknown');
    expect(result.webhook).toEqual({ inbound: false, retry: 'unknown', audit: 'unknown', schema: 'unknown', version: 'unknown' });
    expect(result.limitations).toHaveLength(12);
  });

  it('keeps unsupported distinct from unknown and emits deterministic diagnostics', () => {
    const result = normalizeChannelCapabilities({
      channel: 'custom', transport: 'official', providerCapability: 'unsupported',
      webhook: { schema: 'unsupported', version: 'v1' },
    });
    expect(result.providerCapability).toBe('unsupported');
    expect(result.webhook.schema).toBe('unsupported');
    expect(result.webhook.version).toBe('v1');
    expect(result.limitations).toEqual([
      'conversation is invalid or absent; preserved as unknown',
      'contact is invalid or absent; preserved as unknown',
      'assignment is invalid or absent; preserved as unknown',
      'handoff is invalid or absent; preserved as unknown',
      'inbound is invalid or absent; preserved as unknown',
      'outbound is invalid or absent; preserved as unknown',
      'humanBoundary is invalid or absent; preserved as unknown',
      'agentBoundary is invalid or absent; preserved as unknown',
      'webhook.inbound is invalid or absent; preserved as unknown',
      'webhook.retry is invalid or absent; preserved as unknown',
      'webhook.audit is invalid or absent; preserved as unknown',
    ]);
  });

  it('rejects an empty channel label without fabricating identity', () => {
    const result = normalizeChannelCapabilities({ channel: '  ', conversation: false });
    expect(result.channel).toBe('unknown');
    expect(result.conversation).toBe(false);
    expect(result.limitations[0]).toBe('channel is missing; preserved as unknown');
  });
});
