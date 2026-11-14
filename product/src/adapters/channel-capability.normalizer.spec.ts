import { describe, expect, it } from 'vitest';
import { normalizeChannelCapabilities } from './channel-capability.normalizer';

describe('normalizeChannelCapabilities', () => {
  it('retains official transport, provider capability, webhook schema/version and human/agent boundaries', () => {
    expect(normalizeChannelCapabilities({
      channel: 'whatsapp-cloud-api',
      transport: 'official',
      providerCapability: 'messages.cloud_webhook',
      conversation: true,
      contact: true,
      assignment: 'unsupported',
      handoff: 'not_observed',
      inbound: true,
      outbound: true,
      humanBoundary: true,
      agentBoundary: false,
      webhook: { inbound: true, retry: true, audit: 'not_requested', schema: 'whatsapp_business_account', version: 'v21.0' },
    })).toEqual({
      channel: 'whatsapp-cloud-api',
      transport: 'official',
      productionEligibleTransport: true,
      providerCapability: 'messages.cloud_webhook',
      conversation: true,
      contact: true,
      assignment: 'unsupported',
      handoff: 'not_observed',
      inbound: true,
      outbound: true,
      humanBoundary: true,
      agentBoundary: false,
      webhook: { inbound: true, retry: true, audit: 'not_requested', schema: 'whatsapp_business_account', version: 'v21.0' },
      limitations: [],
    });
  });

  it('distinguishes inbound-only observation adapters from bidirectional channels', () => {
    const result = normalizeChannelCapabilities({
      channel: 'pancake-pos-webhook',
      transport: 'official',
      providerCapability: 'pos.order.webhook',
      conversation: 'unsupported',
      contact: true,
      assignment: 'unsupported',
      handoff: 'unsupported',
      inbound: true,
      outbound: 'unsupported',
      humanBoundary: true,
      agentBoundary: 'unsupported',
      webhook: { inbound: true, retry: true, audit: 'unknown', schema: 'pancake.pos.order', version: 'v1' },
    });
    expect(result.inbound).toBe(true);
    expect(result.outbound).toBe('unsupported');
    expect(result.conversation).toBe('unsupported');
    expect(result.webhook.audit).toBe('unknown');
    expect(result.productionEligibleTransport).toBe(true);
  });

  it.each([
    ['zca-bridge', 'unofficial', false],
    ['wateaminbox-whatsmeow', 'unofficial', false],
    ['zalo-oa-official', 'official', true],
    ['pancake-partner', 'partner', true],
  ] as const)('classifies %s (%s) production eligibility=%s without upgrading unknown capabilities', (channel, transport, eligible) => {
    const result = normalizeChannelCapabilities({
      channel,
      transport,
      providerCapability: 'message.receive',
      inbound: true,
      outbound: 'unknown',
    });
    expect(result.channel).toBe(channel);
    expect(result.transport).toBe(transport);
    expect(result.productionEligibleTransport).toBe(eligible);
    expect(result.inbound).toBe(true);
    expect(result.outbound).toBe('unknown');
    if (transport === 'unofficial') {
      expect(result.limitations).toContain('unofficial transport is rejected for production connector enablement');
    }
  });

  it('enforces I-03 human/agent permission boundary when agentBoundary exceeds humanBoundary', () => {
    const result = normalizeChannelCapabilities({
      channel: 'chatwoot',
      transport: 'official',
      providerCapability: 'conversation.reply',
      conversation: true,
      contact: true,
      assignment: true,
      handoff: true,
      inbound: true,
      outbound: true,
      humanBoundary: false,
      agentBoundary: true,
      webhook: { inbound: true, retry: false, audit: false, schema: 'chatwoot.event', version: 'v4' },
    });
    expect(result.humanBoundary).toBe(false);
    expect(result.agentBoundary).toBe('unknown');
    expect(result.limitations).toContain('agentBoundary cannot exceed humanBoundary (I-03 draft-only); downgraded to unknown');
  });

  it('keeps unsupported and false distinct from unknown when inputs are missing or malformed', () => {
    const result = normalizeChannelCapabilities({
      channel: 'custom-channel',
      transport: 'not_observed',
      providerCapability: 'unsupported',
      contact: 'yes' as never,
      outbound: 'unsupported',
      webhook: { inbound: false, schema: 'unsupported', version: 'v1' },
    });
    expect(result.productionEligibleTransport).toBe(false);
    expect(result.providerCapability).toBe('unsupported');
    expect(result.outbound).toBe('unsupported');
    expect(result.contact).toBe('unknown');
    expect(result.conversation).toBe('unknown');
    expect(result.webhook).toEqual({
      inbound: false,
      retry: 'unknown',
      audit: 'unknown',
      schema: 'unsupported',
      version: 'v1',
    });
  });

  it('rejects an empty channel label without fabricating identity', () => {
    const result = normalizeChannelCapabilities({ channel: '  ', conversation: false });
    expect(result.channel).toBe('unknown');
    expect(result.conversation).toBe(false);
    expect(result.limitations[0]).toBe('channel is missing; preserved as unknown');
  });
});
