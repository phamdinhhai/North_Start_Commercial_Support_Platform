import { UNKNOWN_SENTINEL, isValidUnknownState, type UnknownState } from '../domain/unknown-states/unknown-states';

export type CapabilityValue = boolean | 'unsupported' | UnknownState;
export type ChannelTransport = 'official' | 'partner' | 'unofficial' | UnknownState;
export type DirectionalCapability = CapabilityValue;

export interface ChannelCapabilityInput {
  readonly channel: string;
  readonly transport?: ChannelTransport;
  readonly providerCapability?: string | UnknownState;
  readonly conversation?: CapabilityValue;
  readonly contact?: CapabilityValue;
  readonly assignment?: CapabilityValue;
  readonly handoff?: CapabilityValue;
  readonly inbound?: DirectionalCapability;
  readonly outbound?: DirectionalCapability;
  readonly humanBoundary?: CapabilityValue;
  readonly agentBoundary?: CapabilityValue;
  readonly webhook?: {
    readonly inbound?: CapabilityValue;
    readonly retry?: CapabilityValue;
    readonly audit?: CapabilityValue;
    readonly schema?: string | UnknownState;
    readonly version?: string | UnknownState;
  };
}

export interface NormalizedChannelCapabilities {
  readonly channel: string;
  readonly transport: ChannelTransport;
  readonly productionEligibleTransport: boolean;
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

const CAPABILITY_VALUES = new Set<unknown>([
  true,
  false,
  'unsupported',
  ...(['unknown', 'not_applicable', 'not_observed', 'not_requested', 'redacted'] as const),
]);
const TRANSPORTS = new Set<unknown>([
  'official',
  'partner',
  'unofficial',
  ...(['unknown', 'not_applicable', 'not_observed', 'not_requested', 'redacted'] as const),
]);

function normalizeCapability(value: unknown, path: string, limitations: string[]): CapabilityValue {
  if (CAPABILITY_VALUES.has(value)) return value as CapabilityValue;
  limitations.push(`${path} is invalid or absent; preserved as unknown`);
  return UNKNOWN_SENTINEL;
}

function normalizeText(value: unknown, path: string, limitations: string[]): string | UnknownState {
  if (typeof value === 'string' && (value.trim() !== '' || isValidUnknownState(value))) return value;
  limitations.push(`${path} is invalid or absent; preserved as unknown`);
  return UNKNOWN_SENTINEL;
}

/**
 * Narrow provider-neutral capability projection (I-03, I-08, I-11).
 * - Preserves 'unsupported' / false as explicit negative evidence and 'unknown' when unverified.
 * - Flags unofficial transports as non-production-eligible.
 * - Enforces I-03 draft-only boundary: autonomous agent mutation/outbound cannot exceed human boundary.
 */
export function normalizeChannelCapabilities(input: ChannelCapabilityInput): NormalizedChannelCapabilities {
  const limitations: string[] = [];
  const channel = typeof input.channel === 'string' && input.channel.trim() !== ''
    ? input.channel.trim()
    : (limitations.push('channel is missing; preserved as unknown'), UNKNOWN_SENTINEL);
  const transport = TRANSPORTS.has(input.transport) ? input.transport as ChannelTransport
    : (limitations.push('transport is invalid or absent; preserved as unknown'), UNKNOWN_SENTINEL);

  if (transport === 'unofficial') {
    limitations.push('unofficial transport is rejected for production connector enablement');
  }

  const humanBoundary = normalizeCapability(input.humanBoundary, 'humanBoundary', limitations);
  let agentBoundary = normalizeCapability(input.agentBoundary, 'agentBoundary', limitations);
  if (agentBoundary === true && humanBoundary !== true) {
    limitations.push('agentBoundary cannot exceed humanBoundary (I-03 draft-only); downgraded to unknown');
    agentBoundary = UNKNOWN_SENTINEL;
  }

  return {
    channel,
    transport,
    productionEligibleTransport: transport === 'official' || transport === 'partner',
    providerCapability: normalizeText(input.providerCapability, 'providerCapability', limitations),
    conversation: normalizeCapability(input.conversation, 'conversation', limitations),
    contact: normalizeCapability(input.contact, 'contact', limitations),
    assignment: normalizeCapability(input.assignment, 'assignment', limitations),
    handoff: normalizeCapability(input.handoff, 'handoff', limitations),
    inbound: normalizeCapability(input.inbound, 'inbound', limitations),
    outbound: normalizeCapability(input.outbound, 'outbound', limitations),
    humanBoundary,
    agentBoundary,
    webhook: {
      inbound: normalizeCapability(input.webhook?.inbound, 'webhook.inbound', limitations),
      retry: normalizeCapability(input.webhook?.retry, 'webhook.retry', limitations),
      audit: normalizeCapability(input.webhook?.audit, 'webhook.audit', limitations),
      schema: normalizeText(input.webhook?.schema, 'webhook.schema', limitations),
      version: normalizeText(input.webhook?.version, 'webhook.version', limitations),
    },
    limitations,
  };
}
