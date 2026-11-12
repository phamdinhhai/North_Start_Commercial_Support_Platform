#!/usr/bin/env node
/**
 * Safe, opt-in PostgreSQL logical backup and disposable-database verification helper.
 *
 * This script never creates, drops, cleans, or overwrites a database/file. A caller
 * must create disposable local databases and explicitly acknowledge that fact.
 */

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DISPOSABLE_PREFIXES = ['backup_verify_', 'disposable_'];
const COMMANDS = new Set(['backup', 'verify', 'restore-verify']);

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

export function parseArgs(argv) {
  const options = {
    command: argv[0] ?? 'help',
    target: null,
    output: null,
    backup: null,
    restoreTarget: null,
    execute: false,
    json: false,
    force: false,
    help: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }
    if (token === '--execute') {
      options.execute = true;
      continue;
    }
    if (token === '--dry-run') {
      options.execute = false;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '--force') {
      options.force = true;
      continue;
    }
    const match = /^(--target|--output|--backup|--restore-target)=(.*)$/.exec(token);
    if (match) {
      if (!match[2]) throw new UsageError(`${match[1]} requires a value`);
      const key = {
        '--target': 'target',
        '--output': 'output',
        '--backup': 'backup',
        '--restore-target': 'restoreTarget',
      }[match[1]];
      options[key] = match[2];
      continue;
    }
    const key = {
      '--target': 'target',
      '--output': 'output',
      '--backup': 'backup',
      '--restore-target': 'restoreTarget',
    }[token];
    if (key) {
      const value = argv[++index];
      if (!value) throw new UsageError(`${token} requires a value`);
      options[key] = value;
      continue;
    }
    throw new UsageError(`Unknown argument: ${token}`);
  }

  if (!COMMANDS.has(options.command) && options.command !== 'help') {
    throw new UsageError(`Unknown command: ${options.command}`);
  }
  return options;
}

export function targetFingerprint(connectionString, label = 'target') {
  if (!connectionString) throw new UsageError(`${label} is required; refuse implicit environment targets`);
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new UsageError(`${label} must be a valid PostgreSQL URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new UsageError(`${label} must use postgres:// or postgresql://`);
  }
  if (url.search || url.hash) throw new UsageError(`${label} must not contain query parameters or fragments`);
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase().replace(/^\[|\]$/g, ''))) {
    throw new UsageError(`${label} must point to a local PostgreSQL host (localhost, 127.0.0.1, or ::1)`);
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database || database === 'postgres' || database === 'template0' || database === 'template1') {
    throw new UsageError(`${label} must name a caller-created disposable database, not a system database`);
  }
  if (!DISPOSABLE_PREFIXES.some((prefix) => database.startsWith(prefix))) {
    throw new UsageError(`${label} database must start with backup_verify_ or disposable_`);
  }
  return {
    protocol: url.protocol,
    host: url.hostname,
    port: url.port || '5432',
    database,
    user: url.username ? '[provided]' : '[not provided]',
  };
}

function requireAcknowledgement(options, targetLabel) {
  if (!options.execute) return;
  if (process.env.BACKUP_VERIFY_ACK !== 'I_CREATED_THIS_DISPOSABLE_DATABASE') {
    throw new UsageError(
      `${targetLabel} requires BACKUP_VERIFY_ACK=I_CREATED_THIS_DISPOSABLE_DATABASE when --execute is used`,
    );
  }
}

function commandPath(name, envName) {
  const value = process.env[envName]?.trim();
  return value || name;
}

function outputPath(value, label) {
  if (!value) throw new UsageError(`${label} is required`);
  const path = resolve(value);
  if (lstatSyncSafe(path)?.isDirectory()) throw new UsageError(`${label} must be a file path`);
  return path;
}

function lstatSyncSafe(path) {
  try { return lstatSync(path); } catch { return null; }
}

function sha256File(path) {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

function plan(command, options) {
  if (command === 'backup') {
    const target = targetFingerprint(options.target);
    const output = outputPath(options.output, '--output');
    if (existsSync(output) && !options.force) {
      throw new UsageError(`Refuse to overwrite existing backup: ${output}; use --force only after review`);
    }
    requireAcknowledgement(options, 'target');
    return {
      command,
      target,
      output,
      execute: options.execute,
      argv: [commandPath('pg_dump', 'PG_DUMP'), '--format=custom', '--no-owner', '--no-privileges', '--file', output, options.target],
    };
  }

  if (command === 'verify') {
    const backup = outputPath(options.backup, '--backup');
    const target = options.target ? targetFingerprint(options.target) : null;
    if (!existsSync(backup)) throw new UsageError(`Backup file does not exist: ${backup}`);
    if (!statSync(backup).isFile()) throw new UsageError(`Backup path is not a regular file: ${backup}`);
    return {
      command,
      target,
      backup,
      execute: options.execute,
      argv: [commandPath('pg_restore', 'PG_RESTORE'), '--list', backup],
    };
  }

  if (command === 'restore-verify') {
    const backup = outputPath(options.backup, '--backup');
    const restoreTarget = targetFingerprint(options.restoreTarget, 'restore target');
    if (!existsSync(backup)) throw new UsageError(`Backup file does not exist: ${backup}`);
    if (!statSync(backup).isFile()) throw new UsageError(`Backup path is not a regular file: ${backup}`);
    requireAcknowledgement(options, 'restore target');
    return {
      command,
      restoreTarget,
      backup,
      execute: options.execute,
      argv: [commandPath('pg_restore', 'PG_RESTORE'), '--exit-on-error', '--single-transaction', '--dbname', options.restoreTarget, backup],
    };
  }
  throw new UsageError(`Unsupported command: ${command}`);
}

export function buildPlan(options) {
  if (options.help || options.command === 'help') return { command: 'help', execute: false };
  return plan(options.command, options);
}

function runExternal(argv) {
  const [executable, ...args] = argv;
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw new Error(`${executable} could not be started: ${result.error.message}`);
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function resultFor(planResult, external = null) {
  const result = {
    command: planResult.command,
    mode: planResult.execute ? 'executed' : 'dry-run',
    target: planResult.target ?? planResult.restoreTarget ?? null,
    backup: planResult.backup ?? null,
    output: planResult.output ?? null,
    file: null,
    external,
  };
  const filePath = planResult.output ?? planResult.backup;
  if (filePath && existsSync(filePath) && lstatSync(filePath).isFile()) {
    const stat = statSync(filePath);
    result.file = { path: filePath, bytes: stat.size, sha256: sha256File(filePath), name: basename(filePath) };
  }
  return result;
}

function helpText() {
  return `Usage:\n  node scripts/backup-verify.mjs backup --target URL --output FILE [--execute]\n  node scripts/backup-verify.mjs verify --backup FILE [--execute]\n  node scripts/backup-verify.mjs restore-verify --backup FILE --restore-target URL [--execute]\n\nAll targets must be local and named backup_verify_* or disposable_*.\nExecution requires BACKUP_VERIFY_ACK=I_CREATED_THIS_DISPOSABLE_DATABASE.\nNo command creates, drops, cleans, or overwrites a database.\n`;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help || options.command === 'help') {
    process.stdout.write(helpText());
    return 0;
  }
  const planResult = buildPlan(options);
  let external = null;
  if (planResult.execute) {
    external = runExternal(planResult.argv);
    if (external.status !== 0) throw new Error(`${planResult.command} failed (exit=${external.status ?? 'unknown'} signal=${external.signal ?? 'none'})`);
  }
  const result = resultFor(planResult, external);
  process.stdout.write(options.json ? `${JSON.stringify(result)}\n` : `${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`backup-verify refused: ${error.message}\n`);
    process.exitCode = 1;
  });
}
