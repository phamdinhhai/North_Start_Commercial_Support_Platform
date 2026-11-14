import { UNKNOWN_SENTINEL, isValidUnknownState, type UnknownState } from '../domain/unknown-states/unknown-states';

export type CapabilityValue = boolean | UnknownState;
export type ChannelTransport = 'official' | 'unofficial' | UnknownState;
export type DirectionalCapability = CapabilityValue;

export interface ChannelCapabilityInput {
  readonly channel: string;
  readonly transport?: ChannelTransport;
  readonly providerCapability?: string | UnknownState;
  readonly conversation?: boolean | UnknownState;
  readonly contact?: boolean | UnknownState;
  readonly assignment?: boolean | UnknownState;
  readonly handoff?: boolean | UnknownState;
  readonly inbound?: DirectionalCapability;
  readonly outbound?: DirectionalCapability;
  readonly humanBoundary?: CapabilityValue;
  readonly agentBoundary?: CapabilityValue;
  readonly webhook?: {
    readonly inbound?: boolean | UnknownState;
    readonly retry?: boolean | UnknownState;
    readonly audit?: boolean | UnknownState;
    readonly schema?: string | UnknownState;
    readonly version?: string | UnknownState;
  };
}

export interface NormalizedChannelCapabilities {
  readonly channel: string;
  readonly transport: ChannelTransport;
  readonly providerCapability: string | UnknownState;
  readonly conversation: CapabilityValue;
  readonly contact: CapabilityValue;
  readonly assignment: CapabilityValue;
  readonly handoff: CapabilityValue;
  readonly inbound: DirectionalCapability;
  readonly outbound: DirectionalCapability;
  readonly humanBoundary: CapabilityValue;
  readonly agentBoundary: CapabilityValue;
  readonly webhook: {
    readonly inbound: CapabilityValue;
    readonly retry: CapabilityValue;
    readonly audit: CapabilityValue;
    readonly schema: string | UnknownState;
    readonly version: string | UnknownState;
  };
  readonly limitations: readonly string[];
}

const BOOLEAN_OR_UNKNOWN = new Set<unknown>([true, false, ...(['unknown', 'not_applicable', 'not_observed', 'not_requested', 'redacted'] as const)]);
const TRANSPORTS = new Set<unknown>(['official', 'unofficial', ...(['unknown', 'not_applicable', 'not_observed', 'not_requested', 'redacted'] as const)]);

function normalizeBoolean(value: unknown, path: string, limitations: string[]): CapabilityValue {
  if (BOOLEAN_OR_UNKNOWN.has(value)) return value as CapabilityValue;
  limitations.push(`${path} is invalid or absent; preserved as unknown`);
  return UNKNOWN_SENTINEL;
}

function normalizeText(value: unknown, path: string, limitations: string[]): string | UnknownState {
  if (typeof value === 'string' && (value.trim() !== '' || isValidUnknownState(value))) return value;
  limitations.push(`${path} is invalid or absent; preserved as unknown`);
  return UNKNOWN_SENTINEL;
}

/** Narrow provider-neutral capability projection; no support is inferred from a channel name. */
export function normalizeChannelCapabilities(input: ChannelCapabilityInput): NormalizedChannelCapabilities {
  const limitations: string[] = [];
  const channel = typeof input.channel === 'string' && input.channel.trim() !== ''
    ? input.channel.trim()
    : (limitations.push('channel is missing; preserved as unknown'), UNKNOWN_SENTINEL);
  const transport = TRANSPORTS.has(input.transport) ? input.transport as ChannelTransport
    : (limitations.push('transport is invalid or absent; preserved as unknown'), UNKNOWN_SENTINEL);

  return {
    channel,
    transport,
    providerCapability: normalizeText(input.providerCapability, 'providerCapability', limitations),
    conversation: normalizeBoolean(input.conversation, 'conversation', limitations),
    contact: normalizeBoolean(input.contact, 'contact', limitations),
    assignment: normalizeBoolean(input.assignment, 'assignment', limitations),
    handoff: normalizeBoolean(input.handoff, 'handoff', limitations),
    inbound: normalizeBoolean(input.inbound, 'inbound', limitations),
    outbound: normalizeBoolean(input.outbound, 'outbound', limitations),
    humanBoundary: normalizeBoolean(input.humanBoundary, 'humanBoundary', limitations),
    agentBoundary: normalizeBoolean(input.agentBoundary, 'agentBoundary', limitations),
    webhook: {
      inbound: normalizeBoolean(input.webhook?.inbound, 'webhook.inbound', limitations),
      retry: normalizeBoolean(input.webhook?.retry, 'webhook.retry', limitations),
      audit: normalizeBoolean(input.webhook?.audit, 'webhook.audit', limitations),
      schema: normalizeText(input.webhook?.schema, 'webhook.schema', limitations),
      version: normalizeText(input.webhook?.version, 'webhook.version', limitations),
    },
    limitations,
  };
}
