/**
 * UNKNOWN States (R-17, I-08, I-12) — canonical truth states.
 *
 * Five distinct states: unknown, not_applicable, not_observed, not_requested, redacted.
 * Never collapse to null/empty. Always surfaced with honest visibility.
 */

export const UNKNOWN_STATES = [
  'unknown',
  'not_applicable',
  'not_observed',
  'not_requested',
  'redacted',
] as const;

export type UnknownState = (typeof UNKNOWN_STATES)[number];

/** Sentinel value — canonical UNKNOWN, never null/empty. */
export const UNKNOWN_SENTINEL: UnknownState = 'unknown';

/** Type guard: is value a valid UnknownState? */
export function isValidUnknownState(value: unknown): value is UnknownState {
  return typeof value === 'string' && (UNKNOWN_STATES as readonly string[]).includes(value);
}

/** Alias for isValidUnknownState — semantic type guard. */
export function isUnknownState(value: unknown): value is UnknownState {
  return isValidUnknownState(value);
}
