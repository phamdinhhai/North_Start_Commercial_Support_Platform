import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateObservation } from './validate-observation.mjs';
const row = { schemaVersion: 1, comprehensionSeconds: 8, usefulness: 'not-assessed', participant: 'P01', scenario: 'S01', attempt: 1, result: 'completed-unaided', unaidedSeconds: 12, assistedSeconds: null, outageSeconds: 0, navigationInterventions: 0, conceptInterventions: 0, recoveryInterventions: 0, environmentInterventions: 0, comprehension: 'correct', trust: 'appropriate-reliance', error: 'none', stopReason: 'none' };
test('categorical observations reject PII fields, arbitrary text and inconsistent unaided claims', () => {
  assert.equal(validateObservation(row), true);
  for (const value of [{ ...row, name: 'private' }, { ...row, participant: 'someone@example.test' }, { ...row, trust: 'free text' }, { ...row, unaidedSeconds: Infinity }, { ...row, navigationInterventions: 1 }, { ...row, result: 'completed-assisted' }, []]) assert.equal(validateObservation(value), false);
});

test('versioned observations reject unknown versions and unbounded comprehension values', () => {
  const { schemaVersion, ...unversioned } = row;
  for (const value of [unversioned, { ...row, schemaVersion: 2 }, { ...row, comprehensionSeconds: -1 }, { ...row, usefulness: 'private free text' }]) assert.equal(validateObservation(value), false);
});
