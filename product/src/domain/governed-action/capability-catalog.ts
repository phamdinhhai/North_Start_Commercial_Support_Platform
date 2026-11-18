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
  /** Opaque grouping label; it carries no scope decision (OPEN: LG-1). */
  readonly family: string;
  readonly description: string;
  readonly riskClass: RiskClass;
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

export function createCapabilityCatalog(definitions: readonly CapabilityDefinition[]): CapabilityCatalog {
  const entries = Object.freeze(definitions.map((d) => Object.freeze({ ...d })));
  const ids = new Set<string>();
  for (const d of entries) {
    if (ids.has(d.id)) throw new Error(`duplicate capability id: ${d.id}`);
    ids.add(d.id);
  }
  return Object.freeze({ entries, find: (id: string) => entries.find((c) => c.id === id) });
}

/**
 * The production catalog ships EMPTY, i.e. deny-all: no outbound capability exists until a
 * product/phase gate admits one.
 * OPEN: LG-1 — whether outbound action capabilities (Pancake send, ad budget/status, POS
 * order) are in current-phase scope is undecided (R2-P-03). OPEN: MM-1 — conversion-upload
 * semantics are undecided (R2-P-04). Concrete research examples live only in a test fixture.
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
