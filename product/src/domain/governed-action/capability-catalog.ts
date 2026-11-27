import { RISK_CLASSES, type JsonValue, type RiskClass } from './governed-action.types';

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

/**
 * What a capability touches. ADR-006: money / budget / order / payment / outbound customer
 * messaging / conversion upload are HIGH impact and force risk class HIGH or CRITICAL.
 */
export type CapabilityImpact =
  | 'money' | 'budget' | 'order' | 'payment' | 'outbound_customer_message' | 'conversion_upload'
  | 'external_record';

export const HIGH_IMPACTS: readonly CapabilityImpact[] = Object.freeze([
  'money', 'budget', 'order', 'payment', 'outbound_customer_message', 'conversion_upload',
]);

/** ADR-006 approval tier: only LOW is the low tier; anything else is high (deny-by-default). */
export type RiskTier = 'low' | 'high';
export function riskTierOf(riskClass: RiskClass): RiskTier {
  return riskClass === 'LOW' ? 'low' : 'high';
}

export interface CapabilityDefinition {
  readonly id: string;
  /** Opaque grouping label; scope is decided by ADR-007 enablement, never by this label. */
  readonly family: string;
  readonly description: string;
  /** ADR-006 risk class (catalog data). HIGH_IMPACTS require HIGH or CRITICAL. */
  readonly riskClass: RiskClass;
  /** What the capability touches; drives the minimum risk class (ADR-006). */
  readonly impact: readonly CapabilityImpact[];
  /** Consequential actions spend money or reach customers. */
  readonly consequential: boolean;
  /** Spent money / sent messages cannot be undone; at most a separately authorized compensation. */
  readonly reversibility: 'NONE' | 'COMPENSATION_ONLY';
  readonly constraintKind: 'budget' | 'none';
  readonly resourceType: string;
  readonly arguments: { readonly [key: string]: ArgumentRule };
  readonly enabledByDefault: false;
}

/** Lookup of capability definitions; injected into the runtime (never a global). */
export interface CapabilityCatalog {
  readonly entries: readonly CapabilityDefinition[];
  find(id: string): CapabilityDefinition | undefined;
}

/** Reject a definition whose risk class understates what it touches (ADR-006). */
function validateRisk(d: CapabilityDefinition): void {
  if (!RISK_CLASSES.includes(d.riskClass)) throw new Error(`capability ${d.id}: unknown risk class ${String(d.riskClass)}`);
  const high = (d.impact ?? []).filter((i) => HIGH_IMPACTS.includes(i));
  if (high.length > 0 && d.riskClass !== 'HIGH' && d.riskClass !== 'CRITICAL') throw new Error(`capability ${d.id}: high-impact (${high.join(', ')}) requires risk class HIGH or CRITICAL`);
}

export function createCapabilityCatalog(definitions: readonly CapabilityDefinition[]): CapabilityCatalog {
  const entries = Object.freeze(definitions.map((d) => Object.freeze({ ...d, impact: Object.freeze([...(d.impact ?? [])]) })));
  const ids = new Set<string>();
  for (const d of entries) {
    if (ids.has(d.id)) throw new Error(`duplicate capability id: ${d.id}`);
    validateRisk(d);
    ids.add(d.id);
  }
  return Object.freeze({ entries, find: (id: string) => entries.find((c) => c.id === id) });
}

/**
 * The production catalog ships EMPTY, i.e. deny-all.
 * ADR-007 (resolves LG-1): outbound/consequential capabilities exist only in test fixtures;
 * admitting one for real data needs a DECISION_LOG/ADR entry (provider rights, readback
 * contract, ADR-006 risk class, kill switch, rollback) after the pre-PH4 gate verdict.
 * ADR-008 (resolves MM-1): conversion export stays off; when admitted it is HIGH risk, admin-
 * approved, and exports only `corroborated` outcomes with recorded consent.
 */
export const PRODUCTION_CAPABILITY_CATALOG: CapabilityCatalog = createCapabilityCatalog([]);

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
