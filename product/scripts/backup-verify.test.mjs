import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPlan, parseArgs, targetFingerprint, UsageError } from './backup-verify.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

describe('backup-verify safeguards', () => {
  it('requires an explicit local disposable target', () => {
    assert.throws(() => targetFingerprint('postgres://localhost:5432/north_star'), UsageError);
    assert.throws(() => targetFingerprint('postgres://db.example/north_start'), /local PostgreSQL host/);
    assert.equal(targetFingerprint('postgres://localhost:5432/backup_verify_case').database, 'backup_verify_case');
  });

  it('refuses query and fragment overrides of the verified target', () => {
    for (const suffix of ['?dbname=production', '?host=remote.example', '?%64bname=production', '#production']) {
      assert.throws(() => targetFingerprint(`postgres://localhost/disposable_case${suffix}`), /query parameters or fragments/);
    }
    assert.equal(targetFingerprint('postgres://[::1]/disposable_case').database, 'disposable_case');
  });

  it('executes the CLI entry point and emits a dry-run result on this platform', () => {
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('./backup-verify.mjs', import.meta.url)),
      'backup', '--target', 'postgres://127.0.0.1/disposable_cli', '--output', 'disposable_cli.dump', '--dry-run', '--json'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout).mode, 'dry-run');
    assert.equal(JSON.parse(run.stdout).target.database, 'disposable_cli');
  });

  it('builds a dry-run backup without invoking pg_dump', () => {
    const plan = buildPlan(parseArgs([
      'backup', '--target', 'postgres://127.0.0.1:55432/backup_verify_case',
      '--output', 'backup_verify_case.dump', '--dry-run',
    ]));
    assert.equal(plan.execute, false);
    assert.equal(plan.argv[0], 'pg_dump');
    assert.ok(plan.argv.includes('--format=custom'));
  });

  it('requires acknowledgement before execution', () => {
    assert.throws(() => buildPlan(parseArgs([
      'backup', '--target', 'postgres://localhost/backup_verify_case',
      '--output', 'backup_verify_case.dump', '--execute',
    ])), /BACKUP_VERIFY_ACK/);
  });

  it('refuses implicit targets and system restore targets', () => {
    assert.throws(() => buildPlan(parseArgs(['verify', '--backup', 'missing.dump'])), /does not exist/);
    assert.throws(() => buildPlan(parseArgs([
      'restore-verify', '--backup', 'backup.dump', '--restore-target',
      'postgres://localhost/postgres', '--dry-run',
    ])), /system database/);
  });
});
