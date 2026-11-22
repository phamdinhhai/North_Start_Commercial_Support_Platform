import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ephemeralFrameDigester, MAX_RESEARCH_RETENTION_DAYS, researchCaptureGate } from './research-capture-gate.mjs';

const spec = { researchCapture: { authorizedWorkspaceId: 'research-ws', retentionDays: 7 } };
const now = Date.parse('2026-11-18T00:00:00.000Z');

test('research capture requires the explicit flag, an authorized workspace and retention of at most 7 days', () => {
  assert.throws(() => researchCaptureGate({}, spec, now), /research_capture_flag_required/);
  assert.throws(() => researchCaptureGate({ AIL_RESEARCH_CAPTURE: 'true' }, spec, now), /research_capture_flag_required/);
  assert.throws(() => researchCaptureGate({ AIL_RESEARCH_CAPTURE: 'explicit' }, {}, now), /research_workspace_required/);
  for (const retentionDays of [0, 8, 1.5, undefined]) {
    assert.throws(() => researchCaptureGate({ AIL_RESEARCH_CAPTURE: 'explicit' }, { researchCapture: { authorizedWorkspaceId: 'w', retentionDays } }, now), /research_retention_invalid/);
  }
  const grant = researchCaptureGate({ AIL_RESEARCH_CAPTURE: 'explicit' }, spec, now);
  assert.equal(MAX_RESEARCH_RETENTION_DAYS, 7);
  assert.deepEqual({ ...grant }, { authorizedWorkspaceId: 'research-ws', retentionDays: 7, retainUntil: '2026-11-25T00:00:00.000Z', deletion: 'operator-manual-not-automated' });
});

test('frame digests are keyed per run, never the unkeyed sha256', () => {
  const raw = '[null,null,"pages:p","pages:update_messages",{"message":"ok"}]';
  const first = ephemeralFrameDigester();
  const second = ephemeralFrameDigester();
  assert.equal(first(raw), first(raw));
  assert.notEqual(first(raw), second(raw));
  assert.notEqual(first(raw), createHash('sha256').update(raw).digest('hex'));
  assert.throws(() => ephemeralFrameDigester(new Uint8Array(16)), /invalid_ephemeral_key/);
});
