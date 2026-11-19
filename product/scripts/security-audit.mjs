// Dependency audit gate: production dependencies must have no high/critical advisory;
// dev-only advisories may be waived only by an exact, unexpired, justified exception.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const productRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const exceptionsPath = resolve(productRoot, '../docs/config/audit-exceptions.json');
const BLOCKING = new Set(['high', 'critical']);
const GHSA = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;

function runAudit(args) {
  try {
    return JSON.parse(execFileSync('npm', ['audit', '--json', ...args], {
      cwd: productRoot, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024,
    }));
  } catch (error) {
    // npm audit exits non-zero when advisories exist; its JSON report is still on stdout.
    if (typeof error.stdout === 'string' && error.stdout.trim().startsWith('{')) return JSON.parse(error.stdout);
    throw error;
  }
}

/** Root advisories (objects in `via`) at blocking severity, keyed by GHSA id. */
export function blockingAdvisories(report) {
  const found = new Map();
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
      const id = String(via.url ?? '').split('/').pop();
      found.set(id, { id, packageName: via.name, severity: via.severity, url: via.url });
    }
  }
  return [...found.values()];
}

export function validateExceptions(exceptions, now = new Date()) {
  const errors = [];
  if (!Array.isArray(exceptions)) return ['exceptions must be an array'];
  for (const e of exceptions) {
    const label = e?.id ?? '<missing id>';
    if (!GHSA.test(String(e?.id))) errors.push(`${label}: id must be an exact GHSA identifier`);
    if (typeof e?.package !== 'string' || !e.package) errors.push(`${label}: package is required`);
    if (e?.scope !== 'dev-only') errors.push(`${label}: only dev-only exceptions are allowed`);
    if (typeof e?.reason !== 'string' || e.reason.length < 40) errors.push(`${label}: reason must justify the risk`);
    if (typeof e?.approval !== 'string' || !e.approval) errors.push(`${label}: approval status is required`);
    const expires = new Date(String(e?.expires));
    if (Number.isNaN(expires.getTime())) errors.push(`${label}: expires must be an ISO date`);
    else if (expires <= now) errors.push(`${label}: exception expired on ${e.expires}`);
    else if (expires.getTime() - now.getTime() > 45 * 86_400_000) errors.push(`${label}: exception may not exceed 45 days`);
  }
  return errors;
}

export function evaluate({ full, production, exceptions, now = new Date() }) {
  const errors = validateExceptions(exceptions, now);
  for (const a of blockingAdvisories(production)) {
    errors.push(`production dependency advisory ${a.id} (${a.packageName}, ${a.severity}) cannot be waived`);
  }
  const waived = new Map(exceptions.map((e) => [e.id, e]));
  const accepted = [];
  for (const a of blockingAdvisories(full)) {
    const e = waived.get(a.id);
    if (!e || e.package !== a.packageName) errors.push(`unwaived advisory ${a.id} (${a.packageName}, ${a.severity}) ${a.url}`);
    else accepted.push(a);
  }
  return { errors, accepted };
}

async function main() {
  const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8')).exceptions;
  const result = evaluate({ full: runAudit([]), production: runAudit(['--omit=dev']), exceptions });
  for (const a of result.accepted) console.warn(`WAIVED (dev-only, time-boxed): ${a.id} ${a.packageName} ${a.severity}`);
  if (result.errors.length) {
    for (const e of result.errors) console.error(`AUDIT FAIL: ${e}`);
    process.exit(1);
  }
  console.log(`Dependency audit: PASS (production clean; ${result.accepted.length} dev-only waiver(s) applied)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
