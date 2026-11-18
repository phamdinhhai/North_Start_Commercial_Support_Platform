import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import contracts from '../adaptive-connectivity/pancake-contract-fixtures.json';
import { OBSERVATION_METADATA_KEYS } from '../adaptive-connectivity/observation';
import { OBSERVATION_UPLOAD_KEYS, validateUpload } from '../../application/integration/upload-validation';
import { ackFor, directory, grant, harness, key, load, scope } from './companion-test-harness';

const at = '2026-11-18T00:00:00.000Z';
const HEX_DIGEST = /[a-f0-9]{64}/;
const serverScope = { workspaceId: scope.workspaceId, connectionId: scope.connectionId, accountId: scope.accountId, providerSurface: 'pancake-conversations' as const, pageId: scope.pageId };

describe('ADR-009: the companion sends no body-derived digest', () => {
  it('summarizeFrame emits exactly the shared metadata keys, with no payloadHash and no 64-hex digest', async () => {
    const { summarizeFrame } = await load('protocol.mjs');
    for (const fixture of contracts.cases) {
      const record = await summarizeFrame(JSON.stringify(fixture.frame), scope, at, 'capture-test');
      expect(record, fixture.name).not.toBeNull();
      expect(Object.keys(record).sort()).toEqual([...OBSERVATION_METADATA_KEYS].sort());
      expect(record).not.toHaveProperty('payloadHash');
      expect(JSON.stringify(record)).not.toMatch(HEX_DIGEST);
    }
  });

  it('is invariant to message body: two frames differing only in private text yield identical records', async () => {
    const { summarizeFrame } = await load('protocol.mjs');
    const frame = (text: string) => JSON.stringify([null, null, 'pages:page-test', 'pages:update_messages',
      { conversation_id: 'object-test', messages: [{ id: 'm-1', message: text }] }]);
    expect(await summarizeFrame(frame('0901234567'), scope, at, 'capture-test')).toEqual(await summarizeFrame(frame('ok'), scope, at, 'capture-test'));
  });

  it('browser and server agree on one key set, and the server accepts what the worker uploads', async () => {
    expect([...OBSERVATION_UPLOAD_KEYS].sort()).toEqual([...OBSERVATION_METADATA_KEYS].sort());
    let body: any;
    const h = await harness({}, async (_url: string, options: any) => { body = JSON.parse(options.body); return new Response(JSON.stringify(ackFor(body)), { status: 200 }); });
    await h.message('configure-upload', { origin: 'https://backend.example', enrollment: grant });
    await h.message('start', { scope }); h.socket(); h.frame();
    await h.message('upload');
    expect(body.observation).not.toHaveProperty('payloadHash');
    expect(JSON.stringify(body)).not.toMatch(HEX_DIGEST);
    expect(validateUpload(body, serverScope).observation).toEqual(body.observation);
    expect(JSON.stringify(h.storage[key])).not.toMatch(/private-fixture-text|payloadHash/);
  });

  it('protocol.mjs contains no content digest computation', async () => {
    const source = await readFile(resolve(directory, 'protocol.mjs'), 'utf8');
    expect(source).not.toMatch(/crypto\.subtle|payloadHash|digest\(/);
  });
});
