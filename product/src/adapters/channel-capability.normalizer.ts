import { UNKNOWN_SENTINEL, type UnknownState } from '../domain/unknown-states/unknown-states';

export type CapabilityValue = boolean | UnknownState;

export interface ChannelCapabilityInput {
  readonly channel: string;
  readonly conversation?: boolean | UnknownState;
  readonly contact?: boolean | UnknownState;
  readonly assignment?: boolean | UnknownState;
  readonly handoff?: boolean | UnknownState;
  readonly webhook?: {
    readonly inbound?: boolean | UnknownState;
    readonly retry?: boolean | UnknownState;
    readonly audit?: boolean | UnknownState;
  };
}

export interface NormalizedChannelCapabilities {
  readonly channel: string;
  readonly conversation: CapabilityValue;
  readonly contact: CapabilityValue;
  readonly assignment: CapabilityValue;
  readonly handoff: CapabilityValue;
  readonly webhook: {
    readonly inbound: CapabilityValue;
    readonly retry: CapabilityValue;
    readonly audit: CapabilityValue;
  };
  readonly limitations: readonly string[];
}

const UNKNOWN_OR_BOOLEAN = new Set<unknown>([
  true,
  false,
  'unknown',
  'not_applicable',
  'not_observed',
  'not_requested',
  'redacted',
]);

function normalizeValue(value: unknown, path: string, limitations: string[]): CapabilityValue {
  if (UNKNOWN_OR_BOOLEAN.has(value)) return value as CapabilityValue;
  limitations.push(`${path} is invalid or absent; preserved as unknown`);
  return UNKNOWN_SENTINEL;
}

/**
 * Converts adapter observations into a deliberately narrow capability shape.
 * It never infers support from a repository name or fills missing evidence with false.
 */
export function normalizeChannelCapabilities(input: ChannelCapabilityInput): NormalizedChannelCapabilities {
  const limitations: string[] = [];
  const channel = typeof input.channel === 'string' && input.channel.trim() !== ''
    ? input.channel.trim()
    : (limitations.push('channel is missing; preserved as unknown'), UNKNOWN_SENTINEL);

  return {
    channel,
    conversation: normalizeValue(input.conversation, 'conversation', limitations),
    contact: normalizeValue(input.contact, 'contact', limitations),
    assignment: normalizeValue(input.assignment, 'assignment', limitations),
    handoff: normalizeValue(input.handoff, 'handoff', limitations),
    webhook: {
      inbound: normalizeValue(input.webhook?.inbound, 'webhook.inbound', limitations),
      retry: normalizeValue(input.webhook?.retry, 'webhook.retry', limitations),
      audit: normalizeValue(input.webhook?.audit, 'webhook.audit', limitations),
    },
    limitations,
  };
}
