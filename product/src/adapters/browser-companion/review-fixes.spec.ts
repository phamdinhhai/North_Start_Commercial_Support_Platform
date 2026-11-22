import { describe, expect, it } from 'vitest';
import { grant, harness, key, load, restartWithLostDebugger, scope } from './companion-test-harness';

const origin = 'https://backend.example';

describe('R2-I-09: retired enrollments require a fresh grant', () => {
  it('refuses re-pasting a reset enrollment id instead of restarting its sequence at 1', async () => {
    const h = await harness({}, async () => new Response(JSON.stringify({ code: 'SEQUENCE_GAP' }), { status: 409 }));
    await h.message('configure-upload', { origin, enrollment: grant });
    await h.message('start', { scope }); h.socket(); h.frame(); await h.message('status');
    await h.message('upload');
    expect((await h.message('reset-enrollment', { disposition: 'discarded', confirmDiscard: 1 })).ok).toBe(true);
    expect((await h.message('status')).result.freshEnrollmentRequired).toBe(true);
    expect(await h.message('configure-upload', { origin, enrollment: grant })).toMatchObject({ ok: false, code: 'fresh_enrollment_required' });
    expect(h.storage[key].upload).toBeUndefined();
    expect((await h.message('configure-upload', { origin, enrollment: { ...grant, enrollmentId: 'grant-fresh' } })).ok).toBe(true);
    expect((await h.message('status')).result.freshEnrollmentRequired).toBe(false);
  });

  it('retires a replaced enrollment so switching back cannot reuse sequence 1', async () => {
    const api = await load('upload.mjs');
    const first = api.configureUpload({ outbox: [], session: null }, { origin, enrollment: grant });
    const second = api.configureUpload(first, { origin, enrollment: { ...grant, enrollmentId: 'grant-b' } });
    expect(second.retiredEnrollments).toEqual(['grant']);
    expect(() => api.configureUpload(second, { origin, enrollment: grant })).toThrow('fresh_enrollment_required');
    expect(api.configureUpload(second, { origin, enrollment: { ...grant, enrollmentId: 'grant-b' } }).upload.enrollmentId).toBe('grant-b');
  });
});

describe('R2-I-10: gap markers advance and every discarded frame is counted', () => {
  it('opens a gap on each stop reason and closes it when capture restarts', async () => {
    const h = await harness();
    expect((await h.message('status')).result.gaps).toEqual([expect.objectContaining({ reason: 'not-started', until: null })]);
    await h.message('start', { scope });
    expect(h.storage[key].gaps.at(-1).until).not.toBeNull();
    h.handlers.tabRemoved(1); await h.message('status');
    const tabClosed = h.storage[key].gaps.at(-1);
    expect(tabClosed).toMatchObject({ reason: 'tab-closed', until: null });
    expect(h.storage[key].gapSince).toBe(tabClosed.from);
    await new Promise((done) => setTimeout(done, 2));
    await h.message('start', { scope });
    h.setTabUrl('https://example.org/'); h.handlers.tabUpdated(1, { status: 'loading' }); await h.message('status');
    const navigated = h.storage[key].gaps.at(-1);
    expect(navigated).toMatchObject({ reason: 'navigated-away', until: null });
    expect(Date.parse(navigated.from)).toBeGreaterThan(Date.parse(tabClosed.from)); // gapSince advances, not install time
    expect(h.storage[key].gapSince).toBe(navigated.from);
  });

  it('marks socket-closed gaps during a session and closes them when a socket reopens', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket(); await h.message('status');
    h.handlers.event({ tabId: 1 }, 'Network.webSocketClosed', { requestId: 'socket-1' }); await h.message('status');
    expect(h.storage[key].gaps.at(-1)).toMatchObject({ reason: 'socket-closed', until: null });
    h.socket('socket-2'); await h.message('status');
    expect(h.storage[key].gaps.at(-1).until).not.toBeNull();
  });

  it('records a possible worker-loss gap only when a new worker starts during an active session', async () => {
    const idle = await harness(); await idle.message('stop');
    const idleRestart = await harness(structuredClone(idle.storage)); await idleRestart.message('status');
    expect(idleRestart.storage[key].gaps.some((gap: any) => gap.reason === 'worker-restarted')).toBe(false);
    const h = await harness(); await h.message('start', { scope }); h.socket(); h.frame(); await h.message('status');
    const resumed = await harness(structuredClone(h.storage)); await resumed.message('status');
    expect(resumed.storage[key].gaps.at(-1)).toMatchObject({ reason: 'worker-restarted', possible: true, from: h.storage[key].lastObservedAt });
  });

  it('stops honestly when the restarted worker lost its debugger session (no silent "active" state, no re-attach)', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket(); h.frame(); await h.message('status');
    const resumed = await restartWithLostDebugger(structuredClone(h.storage));
    const status = (await resumed.message('status')).result;
    expect(status).toMatchObject({ active: false, lastStop: 'worker-lost-debugger' });
    expect(resumed.storage[key].gaps.at(-1)).toMatchObject({ reason: 'worker-lost-debugger', until: null });
    expect(resumed.calls).not.toContain('attach');
    expect(resumed.storage[key].outbox).toHaveLength(1);
  });

  it('counts frames rejected by size and backlog guards in dropped', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket(); await h.message('status');
    h.handlers.event({ tabId: 1 }, 'Network.webSocketFrameReceived', { requestId: 'socket-1', response: { opcode: 1, payloadData: 'x'.repeat(262145) } });
    await h.message('status');
    expect(h.storage[key]).toMatchObject({ lastStop: 'frame-size-limit', dropped: 1 });
    const b = await harness(); await b.message('start', { scope }); b.socket(); await b.message('status');
    for (let i = 0; i < 130; i += 1) b.frame();
    await b.message('status');
    expect(b.storage[key].lastStop).toBe('event-backlog');
    expect(b.storage[key].outbox.length + b.storage[key].dropped).toBe(130); // stored or counted, never silently lost
  });
});

describe('R2-I-11: capture ordering claims rely on upload sequence state', () => {
  it('has no unused local capture counter; non-reuse is carried by persisted pending + nextSequence', async () => {
    const h = await harness(); await h.message('configure-upload', { origin, enrollment: grant });
    await h.message('start', { scope }); h.socket(); h.frame(); h.frame(); await h.message('upload');
    const state = h.storage[key];
    expect(state.captureSeq).toBeUndefined();
    expect(state.upload).toMatchObject({ nextSequence: 1, pending: { sequence: 1, captureId: state.outbox[0].captureId } });
    const restarted = await harness(structuredClone(h.storage)); await restarted.message('upload');
    expect(restarted.storage[key].upload.pending).toEqual(state.upload.pending);
  });
});
