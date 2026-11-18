import { describe, expect, it } from 'vitest';
import { ackFor, grant, harness, key, load, scope } from './companion-test-harness';

const until = async (check: () => boolean) => { for (let i = 0; i < 200 && !check(); i += 1) await new Promise((done) => setTimeout(done, 1)); expect(check()).toBe(true); };

async function captured(count: number, fetcher?: any) {
  const h = await harness({}, fetcher);
  expect((await h.message('configure-upload', { origin: 'https://backend.example', enrollment: grant })).ok).toBe(true);
  await h.message('start', { scope }); h.socket();
  for (let i = 0; i < count; i += 1) h.frame();
  await h.message('status');
  return h;
}

describe('service-worker termination mid-upload', () => {
  it('resumes the identical request after termination, allocates no sequence twice and loses no record', async () => {
    const first = await captured(3, () => new Promise(() => {})); // fetch never settles: worker is killed mid-upload
    void first.message('upload');
    await until(() => Boolean(first.storage[key].upload?.pending));
    const killed = structuredClone(first.storage);
    expect(killed[key].upload).toMatchObject({ enrollmentId: 'grant', token: grant.token, status: 'pending', nextSequence: 1 });
    expect(killed[key].outbox).toHaveLength(3);
    const pending = killed[key].upload.pending;

    const server: any[] = [];
    let commitThenDrop = true;
    const fetcher = async (_url: string, options: any) => {
      const request = JSON.parse(options.body);
      const prior = server.find((item) => item.sequence === request.sequence);
      server.push(request);
      if (commitThenDrop && !prior) { commitThenDrop = false; throw new Error('connection reset after commit'); }
      return new Response(JSON.stringify(ackFor(request, prior ? { disposition: 'duplicate' } : {})), { status: 200 });
    };
    const second = await harness(killed, fetcher);
    second.frame(); await second.message('status'); // session and enrollment survived; capture continues
    expect(server).toHaveLength(0); // no alarm or background upload after restart
    expect(second.storage[key].outbox).toHaveLength(4);
    // The new worker instance declares a possible loss window from the last persisted observation.
    expect(second.storage[key].gaps.at(-1)).toMatchObject({ reason: 'worker-restarted', possible: true, from: killed[key].lastObservedAt });
    await second.message('upload'); // server committed, ACK lost
    expect(second.storage[key].upload).toMatchObject({ status: 'retry-required', pending });

    const third = await harness(structuredClone(second.storage), fetcher); // terminated again before the retry
    for (let i = 0; i < 5; i += 1) await third.message('upload');
    expect(third.storage[key].outbox).toHaveLength(0);
    expect(third.storage[key].upload).toMatchObject({ nextSequence: 5, checkpoint: 4, pending: null });
    expect(server.map((request) => request.sequence)).toEqual([1, 1, 2, 3, 4]);
    expect(server[0]).toEqual(pending);
    const bySequence = new Map<number, string>();
    for (const request of server) {
      expect(bySequence.get(request.sequence) ?? request.captureId).toBe(request.captureId);
      bySequence.set(request.sequence, request.captureId);
    }
    expect(new Set(bySequence.values()).size).toBe(4); // four records, four sequences, none duplicated or lost
  });

  it('documents the alarm policy: none; uploads only on explicit user message', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const source = await readFile(resolve('src/adapters/browser-companion/worker.mjs'), 'utf8');
    const manifest = JSON.parse(await readFile(resolve('src/adapters/browser-companion/manifest.json'), 'utf8'));
    expect(source).not.toMatch(/chrome\.alarms|setInterval/);
    expect(manifest.permissions).not.toContain('alarms');
    let calls = 0;
    const h = await captured(1, async () => { calls += 1; throw new Error('offline'); });
    h.handlers.startup(); await h.message('status');
    expect(calls).toBe(0);
  });
});

describe('outbox bounds', () => {
  it('stops at the record bound with OUTBOX_FULL and never evicts or overwrites', async () => {
    const api = await load('lifecycle.mjs');
    const outbox = Array.from({ length: api.MAX_RECORDS - 1 }, (_, index) => ({ captureId: 'c' + index }));
    const filled = api.appendRecord({ outbox, dropped: 0 }, { captureId: 'last' });
    expect(filled.stop).toBe('OUTBOX_FULL');
    expect(filled.state).toMatchObject({ capture: 'OUTBOX_FULL', dropped: 0 });
    expect(filled.state.captureSeq).toBeUndefined();
    expect(filled.state.outbox.at(-1).captureId).toBe('last');
    const refused = api.appendRecord(filled.state, { captureId: 'overflow' });
    expect(refused.state.outbox).toEqual(filled.state.outbox);
    expect(refused.state).toMatchObject({ dropped: 1 });
    expect(refused.state.gaps.at(-1)).toMatchObject({ reason: 'outbox-full', until: null });
  });

  it('enforces the byte bound without dropping existing records', async () => {
    const api = await load('lifecycle.mjs');
    const big = { captureId: 'big', padding: 'x'.repeat(api.MAX_OUTBOX_BYTES / 2) };
    const once = api.appendRecord({ outbox: [], dropped: 0 }, big);
    expect(once.stop).toBeNull();
    const twice = api.appendRecord(once.state, { ...big, captureId: 'big2' });
    expect(twice.stop).toBe('OUTBOX_FULL');
    expect(twice.state.outbox).toEqual([big]);
    expect(twice.state.dropped).toBe(1);
    expect(api.outboxFull(twice.state)).toBe(false); // bytes remain for small records; capture stays stopped until user acts
  });

  it('worker stops capture visibly when the bound is reached and refuses to restart until resolved', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket(); await h.message('status');
    h.storage[key].outbox = Array.from({ length: 999 }, (_, index) => ({ captureId: 'seed' + index }));
    h.frame(); await h.message('status');
    h.frame(); // queued for the stopped session: counted in dropped, not silently ignored
    h.raw(JSON.stringify([null, null, 'phoenix', 'heartbeat', {}])); // non-evidence frame is not counted
    const status = (await h.message('status')).result;
    expect(status).toMatchObject({ capture: 'OUTBOX_FULL', active: false, pending: 1000, dropped: 1 });
    expect(status.gaps.at(-1)).toMatchObject({ reason: 'outbox-full', until: null });
    expect(status.gapSince).toBe(status.gaps.at(-1).from);
    expect(h.calls).toContain('FULL');
    expect(h.storage[key].outbox[0].captureId).toBe('seed0');
    expect(await h.message('start', { scope })).toMatchObject({ ok: false, code: 'outbox_full' });
  });
});

describe('409 conflict resolution is explicit and user-driven', () => {
  async function blocked(body: unknown = { code: 'SEQUENCE_GAP' }) {
    let calls = 0;
    const h = await captured(2, async () => { calls += 1; return new Response(JSON.stringify(body), { status: 409 }); });
    await h.message('upload');
    return { h, calls: () => calls };
  }

  it('blocks with a named reason, stops capture and never retries automatically', async () => {
    const { h, calls } = await blocked();
    const status = (await h.message('status')).result;
    expect(status).toMatchObject({ upload: 'blocked', blockedReason: 'SEQUENCE_GAP', active: false, pending: 2 });
    expect(h.calls).toContain('BLK');
    expect(await h.message('upload')).toMatchObject({ ok: false, code: 'enrollment_required' });
    expect(calls()).toBe(1);
    expect(await h.message('configure-upload', { origin: 'https://backend.example', enrollment: grant })).toMatchObject({ ok: false, code: 'blocked_requires_reset' });
    expect(await h.message('start', { scope })).toMatchObject({ ok: false, code: 'capture_scope_mismatch' });
  });

  it('maps unknown conflict bodies to CONFLICT_UNKNOWN without echoing server text', async () => {
    const { h } = await blocked({ code: 'X', detail: 'server-private-detail' });
    expect((await h.message('status')).result.blockedReason).toBe('CONFLICT_UNKNOWN');
    expect(JSON.stringify(h.storage)).not.toContain('server-private-detail');
  });

  it('requires a digest-bound export before reset, then forces a fresh enrollment', async () => {
    const { h } = await blocked();
    expect(await h.message('reset-enrollment')).toMatchObject({ ok: false, code: 'export_or_discard_required' });
    expect(await h.message('reset-enrollment', { disposition: 'exported' })).toMatchObject({ ok: false, code: 'export_required' });
    const exported = (await h.message('export')).result;
    expect(JSON.stringify(exported)).not.toMatch(new RegExp(grant.token + '|pending|socket-1|private-fixture-text'));
    expect(exported.delivery).toMatchObject({ status: 'blocked', blockedReason: 'SEQUENCE_GAP' });
    h.storage[key].outbox.push({ captureId: 'late' }); // records changed after export
    expect(await h.message('reset-enrollment', { disposition: 'exported' })).toMatchObject({ ok: false, code: 'export_required' });
    h.storage[key].outbox.pop();
    expect((await h.message('reset-enrollment', { disposition: 'exported' })).ok).toBe(true);
    expect(h.storage[key].upload).toBeUndefined();
    expect(h.storage[key].outbox).toEqual([]);
    expect(h.storage[key].resetHistory.at(-1)).toMatchObject({ enrollmentId: 'grant', reason: 'SEQUENCE_GAP', records: 2, disposition: 'exported' });
    const fresh = { ...grant, enrollmentId: 'grant-2' };
    expect((await h.message('configure-upload', { origin: 'https://backend.example', enrollment: fresh })).ok).toBe(true);
    expect(h.storage[key].upload).toMatchObject({ enrollmentId: 'grant-2', nextSequence: 1, status: 'ready' });
  });

  it('discards only with the exact displayed record count confirmed', async () => {
    const { h } = await blocked();
    expect(await h.message('reset-enrollment', { disposition: 'discarded' })).toMatchObject({ ok: false, code: 'discard_confirmation_required' });
    expect(await h.message('reset-enrollment', { disposition: 'discarded', confirmDiscard: 1 })).toMatchObject({ ok: false, code: 'discard_confirmation_required' });
    expect(h.storage[key].outbox).toHaveLength(2);
    expect((await h.message('reset-enrollment', { disposition: 'discarded', confirmDiscard: 2 })).ok).toBe(true);
    expect(h.storage[key].resetHistory.at(-1)).toMatchObject({ records: 2, disposition: 'discarded' });
  });

  it('refuses reset while delivery is healthy', async () => {
    const h = await captured(1);
    expect(await h.message('reset-enrollment', { disposition: 'discarded', confirmDiscard: 1 })).toMatchObject({ ok: false, code: 'reset_not_required' });
    expect(h.storage[key].outbox).toHaveLength(1);
  });
});
