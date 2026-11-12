import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkArchitecture } from './check-architecture.mjs';

const directories = [];
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });
async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'north-architecture-'));
  directories.push(root);
  for (const [name, source] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source);
  }
  return checkArchitecture(root);
}

test('allows Nest in API/infra and explicit composition wiring', async () => {
  assert.deepEqual(await fixture({
    'api/example.controller.ts': "import { Controller } from '@nestjs/common'; import type { Contract } from '../ports/contract';",
    'infra/example.ts': "import { Injectable } from '@nestjs/common'; import { Pool } from 'pg';",
    'scripts/pilot-loop.module.ts': "import { Example } from '../infra/example'; import { Controller } from '../api/example.controller';",
    'ports/contract.ts': 'export interface Contract {}',
  }), []);
});

test('rejects framework dependencies in domain, application, ports and adapters', async () => {
  const findings = await fixture(Object.fromEntries(['domain', 'application', 'ports', 'adapters'].map((layer) =>
    [`${layer}/bad.ts`, "import { Injectable } from '@nestjs/common'; import { Pool } from 'pg';"])));
  assert.equal(findings.length, 8);
  assert.ok(findings.every((finding) => finding.code === 'ARCH-DEP-002'));
});

test('resolves relative and alias imports instead of scanning path words', async () => {
  const findings = await fixture({
    'api/nested/example.ts': "import { A } from '../../infra/a'; import { B } from '@/infra/b'; import { C } from '../local';",
    'application/example.ts': "import type { A } from '@/adapters/example';",
  });
  assert.equal(findings.length, 3);
  assert.ok(findings.every((finding) => finding.code === 'ARCH-DEP-001'));
});

test('detects dynamic imports, require and import types, ignoring comments', async () => {
  const findings = await fixture({
    'application/example.ts': "// import { A } from '../infra/a';\nconst a = import('../infra/a'); const b = require('../infra/b'); type C = import('../infra/c').C;",
  });
  assert.equal(findings.length, 3);
});

test('rejects unowned scripts, composition back-edges and controller coupling', async () => {
  const findings = await fixture({
    'scripts/unowned.ts': '',
    'domain/escape.ts': "import { AppModule } from '../app.module';",
    'api/example.controller.ts': "import { Other } from './other.controller';",
    'app.module.ts': '',
  });
  assert.deepEqual(findings.map((finding) => finding.code).sort(), ['ARCH-API-001', 'ARCH-DEP-001', 'ARCH-LOC-001']);
});

test('keeps domain independent from ports, including re-exports', async () => {
  const findings = await fixture({
    'domain/example.ts': "export type { Contract } from '../ports/contract';",
    'ports/contract.ts': 'export interface Contract {}',
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'ARCH-DEP-001');
});

test('rejects internal dependencies on unowned paths and source-root escapes', async () => {
  const findings = await fixture({
    'application/example.ts': "import { A } from '../shared/a'; import { B } from '../../external/b';",
  });
  assert.equal(findings.length, 2);
  assert.ok(findings.every((finding) => finding.code === 'ARCH-DEP-003'));
});

test('flags legacy production locations but excludes co-located tests', async () => {
  const findings = await fixture({ 'modules/old.ts': '', 'modules/old.spec.ts': "import { Pool } from 'pg';" });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'ARCH-LOC-002');
});
