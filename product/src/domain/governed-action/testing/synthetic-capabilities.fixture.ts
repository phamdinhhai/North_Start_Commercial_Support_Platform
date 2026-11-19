import { createCapabilityCatalog, type CapabilityCatalog, type CapabilityDefinition } from '../capability-catalog';

/**
 * TEST FIXTURE ONLY — synthetic capability definitions used by specs to exercise the
 * governed-action runtime. Production code must never import this file (guarded by
 * `governed-action.infra.spec.ts`); the production catalog is empty (deny-all).
 *
 * These entries are RESEARCH EXAMPLES, not a scope decision:
 * ADR-007 (LG-1): outbound capabilities live only in fixtures until a per-capability enablement entry.
 * ADR-008 (MM-1): conversion upload exports only corroborated outcomes; risk HIGH (ADR-006).
 */
const def = (d: CapabilityDefinition): CapabilityDefinition => Object.freeze(d);

export const SYNTHETIC_CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = Object.freeze([
  def({
    id: 'ads.campaign.budget.update', family: 'ads', riskClass: 'HIGH', impact: ['money', 'budget'], consequential: true,
    description: 'SYNTHETIC: change a campaign daily budget (exact minor units, explicit currency).',
    reversibility: 'COMPENSATION_ONLY', constraintKind: 'budget', resourceType: 'campaign',
    arguments: { dailyBudget: { kind: 'money' } }, enabledByDefault: false,
  }),
  def({
    id: 'ads.campaign.status.update', family: 'ads', riskClass: 'HIGH', impact: ['budget'], consequential: true,
    description: 'SYNTHETIC: pause or activate a campaign.',
    reversibility: 'COMPENSATION_ONLY', constraintKind: 'none', resourceType: 'campaign',
    arguments: { status: { kind: 'enum', values: ['PAUSED', 'ACTIVE'] } }, enabledByDefault: false,
  }),
  def({
    id: 'ads.offline_conversion.upload', family: 'ads', riskClass: 'HIGH', impact: ['conversion_upload'], consequential: true,
    description: 'SYNTHETIC research example only; export semantics per ADR-008.',
    reversibility: 'NONE', constraintKind: 'none', resourceType: 'conversion_action',
    arguments: { conversionRef: { kind: 'ref' } }, enabledByDefault: false,
  }),
  def({
    id: 'pancake.message.send', family: 'pancake', riskClass: 'HIGH', impact: ['outbound_customer_message'], consequential: true,
    description: 'SYNTHETIC research example only; outbound messaging is fixture-only (ADR-007).',
    reversibility: 'NONE', constraintKind: 'none', resourceType: 'conversation',
    arguments: { draftRef: { kind: 'ref' } }, enabledByDefault: false,
  }),
  def({
    id: 'pancake.conversation.tag.update', family: 'pancake', riskClass: 'LOW', impact: ['external_record'], consequential: true,
    description: 'SYNTHETIC: add or remove a conversation tag in the external inbox.',
    reversibility: 'COMPENSATION_ONLY', constraintKind: 'none', resourceType: 'conversation',
    arguments: { tagRef: { kind: 'ref' }, operation: { kind: 'enum', values: ['ADD', 'REMOVE'] } },
    enabledByDefault: false,
  }),
  def({
    id: 'pos.order.create', family: 'pos', riskClass: 'CRITICAL', impact: ['order', 'money'], consequential: true,
    description: 'SYNTHETIC research example only; ERP/POS writes are a non-goal (ADR-007).',
    reversibility: 'COMPENSATION_ONLY', constraintKind: 'none', resourceType: 'order',
    arguments: { orderDraftRef: { kind: 'ref' } }, enabledByDefault: false,
  }),
]);

export const SYNTHETIC_CAPABILITY_CATALOG: CapabilityCatalog = createCapabilityCatalog(SYNTHETIC_CAPABILITY_DEFINITIONS);
