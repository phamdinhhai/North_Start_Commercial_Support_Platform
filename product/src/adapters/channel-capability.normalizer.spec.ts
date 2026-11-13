import { describe, expect, it } from 'vitest';
import { normalizeChannelCapabilities } from './channel-capability.normalizer';


describe('normalizeChannelCapabilities', () => {
  it('preserves observed capabilities and explicit UNKNOWN values', () => {
    expect(normalizeChannelCapabilities({
      channel: 'chatwoot',
      conversation: true,
      contact: true,
      assignment: true,
      handoff: 'not_observed',
      webhook: { inbound: true, retry: 'unknown', audit: 'not_requested' },
    })).toEqual({
      channel: 'chatwoot',
      conversation: true,
      contact: true,
      assignment: true,
      handoff: 'not_observed',
      webhook: { inbound: true, retry: 'unknown', audit: 'not_requested' },
      limitations: [],
    });
  });

  it('does not infer false from missing or malformed evidence', () => {
    const result = normalizeChannelCapabilities({
      channel: 'zca-bridge',
      conversation: undefined,
      contact: 'yes' as never,
      webhook: { inbound: false },
    });

    expect(result.conversation).toBe('unknown');
    expect(result.contact).toBe('unknown');
    expect(result.assignment).toBe('unknown');
    expect(result.handoff).toBe('unknown');
    expect(result.webhook).toEqual({ inbound: false, retry: 'unknown', audit: 'unknown' });
    expect(result.limitations).toHaveLength(6);
  });

  it('rejects an empty channel label without fabricating identity', () => {
    const result = normalizeChannelCapabilities({ channel: '  ', conversation: false });
    expect(result.channel).toBe('unknown');
    expect(result.conversation).toBe(false);
    expect(result.limitations).toContain('channel is missing; preserved as unknown');
  });
});
