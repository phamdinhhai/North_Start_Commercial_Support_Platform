// Pure lifecycle state transitions for the MV3 companion. No chrome.* access here, so every rule is unit-testable.

/** Outbox bounds. Reaching either bound stops capture; existing records are never evicted or overwritten. */
export const MAX_RECORDS = 1000;
export const MAX_OUTBOX_BYTES = 1048576;
export const OUTBOX_FULL = 'OUTBOX_FULL';

/** Server 409 codes the popup may name. Anything else is shown as CONFLICT_UNKNOWN; no response text is echoed. */
const CONFLICT_CODES = new Set(['SEQUENCE_GAP', 'RECEIPT_CONFLICT', 'CHECKPOINT_REGRESSION']);
export const conflictCode = (body) => (body && CONFLICT_CODES.has(body.code) ? body.code : 'CONFLICT_UNKNOWN');

const encoder = new TextEncoder();
export const recordBytes = (record) => encoder.encode(JSON.stringify(record)).length;
export const outboxBytes = (outbox) => outbox.reduce((total, record) => total + recordBytes(record), 0);

export const MAX_GAPS = 50;
export const MAX_RETIRED_ENROLLMENTS = 50;

/**
 * Gap markers: each interval in which observation was not running (or may have lost queued events).
 * An open gap (until: null) starts when capture stops and closes when capture restarts. gapSince = latest gap start.
 */
export function openGap(state, reason, at = new Date().toISOString()) {
  const gaps = state.gaps ?? [];
  if (gaps.at(-1) && gaps.at(-1).until === null) return { ...state, gaps, gapSince: gaps.at(-1).from };
  return boundGaps({ ...state, gaps: [...gaps, { from: at, until: null, reason }], gapSince: at });
}
export function closeGap(state, at = new Date().toISOString()) {
  const gaps = state.gaps ?? [];
  if (!gaps.at(-1) || gaps.at(-1).until !== null) return state;
  return { ...state, gaps: [...gaps.slice(0, -1), { ...gaps.at(-1), until: at }] };
}
/** A closed interval that MAY have lost events (e.g. queued CDP events when a worker instance was terminated). */
export function possibleGap(state, reason, from, until) {
  if (state.gaps?.at(-1)?.until === null) return state; // already inside a declared gap
  return boundGaps({ ...state, gaps: [...(state.gaps ?? []), { from, until, reason, possible: true }], gapSince: from });
}
function boundGaps(state) {
  const extra = state.gaps.length - MAX_GAPS;
  return extra > 0 ? { ...state, gaps: state.gaps.slice(extra), gapsOverflow: (state.gapsOverflow ?? 0) + extra } : state;
}

/**
 * Append one record or refuse. Record and full-state decision are written in one durable save by the caller.
 * Upload sequence numbers are NOT allocated here; they are allocated only by reserveUpload (persisted pending + nextSequence).
 */
export function appendRecord(state, record, at = new Date().toISOString()) {
  const records = state.outbox.length;
  const bytes = outboxBytes(state.outbox);
  if (records >= MAX_RECORDS || bytes + recordBytes(record) > MAX_OUTBOX_BYTES) {
    // Refused record is counted visibly; nothing already stored is touched.
    return { state: openGap({ ...state, dropped: (state.dropped ?? 0) + 1, capture: OUTBOX_FULL }, 'outbox-full', at), stop: OUTBOX_FULL };
  }
  const outbox = [...state.outbox, record];
  const next = { ...state, outbox, lastObservedAt: at };
  // Stop as soon as the bound is reached so later frames are a declared gap, not silent drops.
  const full = outbox.length >= MAX_RECORDS || bytes + recordBytes(record) >= MAX_OUTBOX_BYTES;
  return full ? { state: { ...next, capture: OUTBOX_FULL }, stop: OUTBOX_FULL } : { state: next, stop: null };
}

export const outboxFull = (state) => state.outbox.length >= MAX_RECORDS || outboxBytes(state.outbox) >= MAX_OUTBOX_BYTES;

/** Order-sensitive digest of the outbox capture identities; binds an export to exactly the records it contained. */
export async function outboxDigest(outbox) {
  const bytes = encoder.encode(outbox.map((record) => String(record?.captureId ?? '')).join('\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

/**
 * User-driven enrollment reset after a blocked/unauthorized/expired delivery. Never retries, never relabels evidence.
 * Old outbox must have been exported (digest-bound) or explicitly discarded with the exact record count confirmed.
 */
export function resetEnrollment(state, input, digest, at = new Date().toISOString()) {
  const upload = state.upload;
  // Local-only mode (no upload grant) may clear a full outbox under the same export/discard rule.
  if (upload && !['blocked', 'unauthorized', 'expired', 'disconnected'].includes(upload.status)) throw new Error('reset_not_required');
  if (!upload && !state.outbox.length) throw new Error('reset_not_required');
  const count = state.outbox.length;
  let disposition = 'empty';
  if (count) {
    if (input?.disposition === 'exported') {
      if (!state.lastExport || state.lastExport.digest !== digest || state.lastExport.records !== count) throw new Error('export_required');
      disposition = 'exported';
    } else if (input?.disposition === 'discarded') {
      if (input.confirmDiscard !== count) throw new Error('discard_confirmation_required');
      disposition = 'discarded';
    } else throw new Error('export_or_discard_required');
  }
  const entry = { at, enrollmentId: upload?.enrollmentId ?? null, reason: upload ? upload.blockedReason ?? upload.status : 'local-only',
    records: count, disposition, checkpoint: upload?.checkpoint ?? 0 };
  const history = [...(state.resetHistory ?? []), entry].slice(-20);
  // Removing the upload grant forces a fresh issuer enrollment; the sequence restarts only under that new enrollment.
  // The retired enrollment id can never be reconfigured locally: its server checkpoint is ahead of a restarted sequence.
  const retiredEnrollments = upload ? [...(state.retiredEnrollments ?? []), upload.enrollmentId].slice(-MAX_RETIRED_ENROLLMENTS) : state.retiredEnrollments;
  const { upload: _removed, lastExport: _export, fullStop: _fullStop, ...rest } = state;
  return openGap({ ...rest, outbox: [], session: null, capture: null, lastStop: 'enrollment-reset', resetHistory: history,
    ...(retiredEnrollments ? { retiredEnrollments } : {}) }, 'enrollment-reset', at);
}

export function statusView(state) {
  const upload = state.upload;
  return {
    active: Boolean(state.session), pending: state.outbox.length, outboxBytes: outboxBytes(state.outbox),
    limits: { records: MAX_RECORDS, bytes: MAX_OUTBOX_BYTES }, capture: state.capture ?? (state.session ? 'ACTIVE' : 'STOPPED'),
    dropped: state.dropped ?? 0, continuity: state.continuity, gapSince: state.gapSince, lastStop: state.lastStop ?? null,
    upload: upload?.status ?? 'disabled', blockedReason: upload?.status === 'blocked' ? upload.blockedReason ?? 'CONFLICT_UNKNOWN' : null,
    checkpoint: upload?.checkpoint ?? null, exported: Boolean(state.lastExport && state.lastExport.records === state.outbox.length),
    drift: driftNotice(state.drift), gaps: (state.gaps ?? []).slice(-5), gapsOverflow: state.gapsOverflow ?? 0,
    freshEnrollmentRequired: !upload && Boolean(state.retiredEnrollments?.length),
  };
}

export function driftNotice(drift) {
  if (!drift?.count) return null;
  return { count: drift.count, overflow: drift.overflow ?? 0,
    samples: (drift.samples ?? []).map(({ fingerprint, kind, count, firstSeenAt, lastSeenAt }) => ({ fingerprint, kind, count, firstSeenAt, lastSeenAt })) };
}
