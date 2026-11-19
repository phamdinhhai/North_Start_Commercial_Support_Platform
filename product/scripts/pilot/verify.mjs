// Explicit local fabricated-data rehearsal; never accepts a URL or database argument.
import { chromium } from '@playwright/test';
import pg from 'pg';
import assert from 'node:assert/strict';
import { validateManifest, connection } from './safety.mjs';
const m = validateManifest(process.argv[2]);
const db = new pg.Client({ connectionString: connection(m) }); await db.connect();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${m.appPort}/v1/operator`);
  await page.locator('#signin').click(); await page.getByLabel('Account').selectOption('owner');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('#new-lead').click();
  await page.locator('#display-name').fill('LOCAL SYNTHETIC persistence rehearsal');
  await page.locator('#utterance').fill('Fabricated fixture statement; no person or provider involved');
  await page.locator('#connection').fill('manual');
  await page.locator('#external-record').fill(crypto.randomUUID());
  await page.locator('#synthetic').check(); await page.locator('#submit-command').click();
  await page.locator('#command-dialog').waitFor({ state: 'hidden' });
  const before = (await db.query('SELECT count(*)::int n FROM lead')).rows[0].n;
  assert(before > 0);
  const res = await fetch(`http://127.0.0.1:${m.controlPort}/restart`, { method: 'POST', headers: { 'x-pilot-control': m.control } }); assert(res.ok);
  await page.reload();
  // Browser sessions are process-local; relogin after app restart is expected.
  await page.locator('#signin').click(); await page.getByLabel('Account').selectOption('owner');
  await page.getByRole('button', { name: 'Continue' }).click();
  assert.equal((await db.query('SELECT count(*)::int n FROM lead')).rows[0].n, before);
  assert.equal((await db.query('SELECT count(*)::int n FROM memberships')).rows[0].n, 6);
  assert.equal((await db.query('SELECT count(DISTINCT base_role)::int n FROM memberships')).rows[0].n, 4);
  const roles = (await db.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert(Object.values(roles).every(v => v === false));
  const own = await page.evaluate(async () => (await (await fetch('/v1/auth/session')).json()).context.workspaceId);
  assert.equal(own, m.workspace);
  const foreignContext = await browser.newContext(); const foreign = await foreignContext.newPage(); await foreign.goto(`http://127.0.0.1:${m.appPort}/v1/operator`);
  await foreign.locator('#signin').click(); await foreign.getByLabel('Account').selectOption('foreign'); await foreign.getByRole('button', { name: 'Continue' }).click();
  const foreignWorkspace = await foreign.evaluate(async () => (await (await fetch('/v1/auth/session')).json()).context.workspaceId);
  assert.equal(foreignWorkspace, `${m.workspace}-foreign`);
  assert.equal(await page.evaluate(async () => (await (await fetch('/v1/auth/session')).json()).context.workspaceId), m.workspace);
  await foreignContext.close();
  console.log(JSON.stringify({ uiSyntheticLead: true, appRestartDurable: true, leads: before, memberships: 6, roles: 4, restrictedDbRole: true, separateWorkspace: true }));
} finally { await browser.close(); await db.end(); }
