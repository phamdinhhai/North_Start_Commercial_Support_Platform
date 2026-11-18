import type { JsonValue, RiskClass } from './governed-action.types';

/**
 * Capability ids are DATA, not code paths. Every capability is disabled by default;
 * enablement is a separate, injected, workspace-scoped decision (CapabilityEnablement port)
 * and no live executor exists in this codebase.
 *
 * Arguments intentionally carry references (draft/order/conversation refs) instead of
 * message bodies or customer PII, so the action store never becomes a PII sink.
 */
export type ArgumentRule =
  | { readonly kind: 'ref' }
  | { readonly kind: 'enum'; readonly values: readonly string[] }
  | { readonly kind: 'money' };

export interface CapabilityDefinition {
  readonly id: string;
  readonly family: 'ads' | 'pancake' | 'pos';
  readonly description: string;
  readonly riskClass: RiskClass;
  /** Consequential actions spend money or reach customers; all current entries are. */
  readonly consequential: boolean;
  /** Spent money / sent messages cannot be undone; at most a separately authorized compensation. */
  readonly reversibility: 'NONE' | 'COMPENSATION_ONLY';
  readonly constraintKind: 'budget' | 'none';
  readonly resourceType: string;
  readonly arguments: { readonly [key: string]: ArgumentRule };
  readonly enabledByDefault: false;
}

const def = (d: CapabilityDefinition): CapabilityDefinition => Object.freeze(d);

export const CAPABILITY_CATALOG: readonly CapabilityDefinition[] = Object.freeze([
  def({
    id: 'ads.campaign.budget.update', family: 'ads', riskClass: 'HIGH', consequential: true,
    description: 'Change a campaign daily budget (exact minor units, explicit currency).',
    reversibility: 'COMPENSATION_ONLY', constraintKind: 'budget', resourceType: 'campaign',
    arguments: { dailyBudget: { kind: 'money' } }, enabledByDefault: false,
  }),
  def({
    id: 'ads.campaign.status.update', family: 'ads', riskClass: 'HIGH', consequential: true,
    description: 'Pause or activate a campaign.',
    reversibility: 'COMPENSATION_ONLY', constraintKind: 'none', resourceType: 'campaign',
    arguments: { status: { kind: 'enum', values: ['PAUSED', 'ACTIVE'] } }, enabledByDefault: false,
  }),
  def({
    id: 'ads.offline_conversion.upload', family: 'ads', riskClass: 'MEDIUM', consequential: true,
    description: 'Upload one offline conversion assertion reference (provider metric, not revenue truth).',
    reversibility: 'NONE', constraintKind: 'none', resourceType: 'conversion_action',
    arguments: { conversionRef: { kind: 'ref' } }, enabledByDefault: false,
  }),
  def({
    id: 'pancake.message.send', family: 'pancake', riskClass: 'HIGH', consequential: true,
    description: 'Send a human-approved draft into a conversation (deferred by ARCHITECTURE_CONSTITUTION §5).',
    reversibility: 'NONE', constraintKind: 'none', resourceType: 'conversation',
    arguments: { draftRef: { kind: 'ref' } }, enabledByDefault: false,
  }),
  def({
    id: 'pancake.conversation.tag.update', family: 'pancake', riskClass: 'LOW', consequential: true,
    description: 'Add or remove a conversation tag in the external inbox.',
    reversibility: 'COMPENSATION_ONLY', constraintKind: 'none', resourceType: 'conversation',
    arguments: { tagRef: { kind: 'ref' }, operation: { kind: 'enum', values: ['ADD', 'REMOVE'] } },
    enabledByDefault: false,
  }),
  def({
    id: 'pos.order.create', family: 'pos', riskClass: 'CRITICAL', consequential: true,
    description: 'Create an order in an external POS from an approved order draft reference.',
    reversibility: 'COMPENSATION_ONLY', constraintKind: 'none', resourceType: 'order',
    arguments: { orderDraftRef: { kind: 'ref' } }, enabledByDefault: false,
  }),
]);

export function findCapability(id: string): CapabilityDefinition | undefined {
  return CAPABILITY_CATALOG.find((c) => c.id === id);
}

const REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MINOR_UNITS = /^(0|[1-9][0-9]{0,17})$/;
const CURRENCY = /^[A-Z]{3}$/;

/** Exact-shape validation: required keys only, no extra keys. Returns violation strings. */
export function validateArguments(capability: CapabilityDefinition, args: JsonValue): string[] {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return ['arguments must be an object'];
  const record = args as { readonly [key: string]: JsonValue };
  const violations: string[] = [];
  for (const key of Object.keys(record)) {
    if (!(key in capability.arguments)) violations.push(`unexpected argument: ${key}`);
  }
  for (const [key, rule] of Object.entries(capability.arguments)) {
    const value = record[key];
    if (value === undefined) { violations.push(`missing argument: ${key}`); continue; }
    if (rule.kind === 'ref' && (typeof value !== 'string' || !REF.test(value))) violations.push(`invalid reference: ${key}`);
    if (rule.kind === 'enum' && (typeof value !== 'string' || !rule.values.includes(value))) violations.push(`invalid enum value: ${key}`);
    if (rule.kind === 'money' && parseMoney(value) === undefined) violations.push(`invalid money: ${key}`);
  }
  return violations;
}

export interface Money {
  readonly amountMinor: bigint;
  readonly currency: string;
}

/** Money is `{ amountMinor: "<integer string>", currency: "ISO4217" }` — never a float. */
export function parseMoney(value: JsonValue | undefined): Money | undefined {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as { readonly [key: string]: JsonValue };
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'amountMinor' || keys[1] !== 'currency') return undefined;
  const { amountMinor, currency } = record;
  if (typeof amountMinor !== 'string' || !MINOR_UNITS.test(amountMinor)) return undefined;
  if (typeof currency !== 'string' || !CURRENCY.test(currency)) return undefined;
  return { amountMinor: BigInt(amountMinor), currency };
}
