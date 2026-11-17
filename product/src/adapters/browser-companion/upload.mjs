import { validScope } from './protocol.mjs';

const id = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f]/.test(value);
const sameScope = (left, right) => ['workspaceId', 'connectionId', 'accountId', 'providerSurface', 'pageId'].every((key) => left?.[key] === right?.[key]);

export function backendOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('invalid_backend_origin');
  return url.origin;
}

/** Local labels are checked for consistency only. The backend verifies the signed authority. */
export function configureUpload(state, input, at = Date.now()) {
  const origin = backendOrigin(input.origin);
  const enrollment = input.enrollment;
  if (!enrollment || !validScope(enrollment.scope) || enrollment.scope.providerSurface !== 'pancake-conversations' ||
      !id(enrollment.enrollmentId) || typeof enrollment.token !== 'string' || enrollment.token.length < 32 || enrollment.token.length > 8192 ||
      /\s/.test(enrollment.token) || !Number.isFinite(Date.parse(enrollment.expiresAt)) || Date.parse(enrollment.expiresAt) <= at) throw new Error('invalid_enrollment');
  const previous = state.upload;
  const same = previous?.enrollmentId === enrollment.enrollmentId && previous.origin === origin && sameScope(previous.scope, enrollment.scope);
  // Historical local-only observations lack a server-bound page grant. Never relabel them.
  if (state.outbox.length && !same) throw new Error('pending_outbox_binding');
  if (state.session && !sameScope({ ...state.session.scope, providerSurface: 'pancake-conversations' }, enrollment.scope)) throw new Error('capture_scope_mismatch');
  return { ...state, upload: {
    origin, enrollmentId: enrollment.enrollmentId, token: enrollment.token, expiresAt: enrollment.expiresAt,
    scope: { ...enrollment.scope }, nextSequence: same ? previous.nextSequence : 1,
    pending: same ? previous.pending : null, checkpoint: same ? previous.checkpoint : 0, status: 'ready',
  } };
}

export function captureMatchesEnrollment(scope, upload) {
  return !upload || (upload.token && !['blocked', 'unauthorized', 'expired'].includes(upload.status) && sameScope({ ...scope, providerSurface: 'pancake-conversations' }, upload.scope));
}

/** Persist this reservation before network I/O; restart retries exactly the same request. */
export function reserveUpload(state, at = Date.now()) {
  const upload = state.upload;
  if (!upload?.token || upload.status === 'blocked') throw new Error('enrollment_required');
  if (Date.parse(upload.expiresAt) <= at) return { ...state, upload: { ...upload, token: null, status: 'expired' } };
  if (!state.outbox.length) return state;
  const observation = state.outbox[0];
  if (!sameScope({ ...observation.scope, pageId: upload.scope.pageId }, upload.scope) || !id(observation.captureId)) throw new Error('observation_scope_mismatch');
  if (upload.pending && upload.pending.captureId !== observation.captureId) throw new Error('outbox_changed');
  if (!Number.isSafeInteger(upload.nextSequence) || upload.nextSequence < 1) throw new Error('sequence_exhausted');
  const pending = upload.pending ?? { captureId: observation.captureId, sequence: upload.nextSequence, pageId: upload.scope.pageId, observation };
  if (new TextEncoder().encode(JSON.stringify(pending)).length > 8192) throw new Error('upload_size_limit');
  return { ...state, upload: { ...upload, pending, status: 'pending' } };
}

/** A response cannot remove a record until a complete durable ACK is validated. */
export function applyUploadResponse(state, status, ack) {
  const upload = state.upload;
  if (!upload?.pending) throw new Error('no_pending_upload');
  if (status === 401 || status === 403) return { ...state, upload: { ...upload, token: null, status: 'unauthorized' } };
  if (status === 409) return { ...state, upload: { ...upload, status: 'blocked' } };
  if (status < 200 || status >= 300 || !ack || !id(ack.receiptId) || !['stored', 'duplicate'].includes(ack.disposition) ||
      ack.captureId !== upload.pending.captureId || ack.sequence !== upload.pending.sequence || ack.enrollmentId !== upload.enrollmentId ||
      !Number.isSafeInteger(ack.checkpoint) || ack.checkpoint < upload.pending.sequence ||
      (ack.disposition === 'stored' && ack.checkpoint !== upload.pending.sequence) || ack.continuity !== 'UNKNOWN') {
    return { ...state, upload: { ...upload, status: 'retry-required' } };
  }
  if (state.outbox[0]?.captureId !== upload.pending.captureId) throw new Error('outbox_changed');
  return { ...state, outbox: state.outbox.slice(1), upload: { ...upload, pending: null, checkpoint: ack.checkpoint,
    nextSequence: ack.checkpoint + 1, status: 'ready' } };
}

export function exportMetadata(state) {
  const { upload, ...metadata } = state;
  return { ...metadata, ...(upload ? { delivery: { enrollmentId: upload.enrollmentId, checkpoint: upload.checkpoint, status: upload.status } } : {}) };
}
