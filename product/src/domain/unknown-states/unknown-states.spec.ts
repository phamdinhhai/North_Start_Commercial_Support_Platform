import { describe, it, expect } from 'vitest';
import {
  UNKNOWN_STATES,
  UNKNOWN_SENTINEL,
  isValidUnknownState,
  isUnknownState,
} from './unknown-states';

describe('UNKNOWN States (R-17, I-08)', () => {
  it('UNKNOWN_STATES contains exactly five canonical values', () => {
    expect(UNKNOWN_STATES).toEqual([
      'unknown',
      'not_applicable',
      'not_observed',
      'not_requested',
      'redacted',
    ]);
  });

  it('UNKNOWN_SENTINEL is "unknown" and never null/empty', () => {
    expect(UNKNOWN_SENTINEL).toBe('unknown');
    expect(UNKNOWN_SENTINEL).not.toBeNull();
    expect(UNKNOWN_SENTINEL).not.toBe('');
    expect(UNKNOWN_SENTINEL.length).toBeGreaterThan(0);
  });

  it('isValidUnknownState returns true for each canonical value', () => {
    for (const v of UNKNOWN_STATES) {
      expect(isValidUnknownState(v)).toBe(true);
    }
  });

  it('isValidUnknownState returns false for null/undefined/empty', () => {
    expect(isValidUnknownState(null)).toBe(false);
    expect(isValidUnknownState(undefined)).toBe(false);
    expect(isValidUnknownState('')).toBe(false);
  });

  it('isValidUnknownState returns false for non-canonical strings', () => {
    expect(isValidUnknownState('UNKNOWN')).toBe(false);
    expect(isValidUnknownState('Unknown')).toBe(false);
    expect(isValidUnknownState('none')).toBe(false);
  });

  it('isUnknownState alias behaves identically', () => {
    expect(isUnknownState('unknown')).toBe(true);
    expect(isUnknownState(null)).toBe(false);
  });

  it('isValidUnknownState returns false for non-string types', () => {
    expect(isValidUnknownState(0)).toBe(false);
    expect(isValidUnknownState(false)).toBe(false);
    expect(isValidUnknownState({})).toBe(false);
  });
});
