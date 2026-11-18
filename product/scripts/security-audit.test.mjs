import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './security-audit.mjs';

const now = new Date('2026-11-18T00:00:00Z');
const advisory = (name, id, severity = 'high') => ({
  vulnerabilities: { [name]: { severity, via: [{ name, severity, url: `https://github.com/advisories/${id}` }] } },
});
const clean = { vulnerabilities: {} };
const exception = {
  id: 'GHSA-fc5q-39xc-vjpf', package: 'picomatch', scope: 'dev-only', expires: '2026-12-18',
  approval: 'PENDING_HUMAN_ACCEPTANCE', reason: 'No patched release exists; reached only through dev tooling globs.',
};

test('waives an exact, unexpired dev-only advisory', () => {
  const r = evaluate({ full: advisory('picomatch', exception.id), production: clean, exceptions: [exception], now });
  assert.deepEqual(r.errors, []);
  assert.equal(r.accepted.length, 1);
});

test('never waives production advisories', () => {
  const full = advisory('picomatch', exception.id);
  const r = evaluate({ full, production: full, exceptions: [exception], now });
  assert.match(r.errors.join('\n'), /production dependency advisory/);
});

test('fails on any other blocking advisory', () => {
  const r = evaluate({ full: advisory('other', 'GHSA-2222-3333-4444'), production: clean, exceptions: [exception], now });
  assert.match(r.errors.join('\n'), /unwaived advisory GHSA-2222-3333-4444/);
});

test('fails when the waived id is reported for a different package', () => {
  const r = evaluate({ full: advisory('lodash', exception.id), production: clean, exceptions: [exception], now });
  assert.match(r.errors.join('\n'), /unwaived advisory/);
});

test('rejects expired, overlong and non-dev exceptions', () => {
  const expired = evaluate({ full: clean, production: clean, exceptions: [{ ...exception, expires: '2026-11-01' }], now });
  assert.match(expired.errors.join('\n'), /expired/);
  const long = evaluate({ full: clean, production: clean, exceptions: [{ ...exception, expires: '2027-06-01' }], now });
  assert.match(long.errors.join('\n'), /45 days/);
  const prod = evaluate({ full: clean, production: clean, exceptions: [{ ...exception, scope: 'all' }], now });
  assert.match(prod.errors.join('\n'), /dev-only/);
});

test('moderate advisories do not block', () => {
  const r = evaluate({ full: advisory('glob', 'GHSA-3g3m-2fjr-6pw4', 'moderate'), production: clean, exceptions: [], now });
  assert.deepEqual(r.errors, []);
});
