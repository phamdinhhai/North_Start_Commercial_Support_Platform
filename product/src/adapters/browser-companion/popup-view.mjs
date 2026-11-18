// Pure presentation mapping for the popup. Inputs are worker status objects; output contains no record values.

const REASONS = {
  SEQUENCE_GAP: 'The server reports a sequence gap: an earlier record for this enrollment was never acknowledged.',
  RECEIPT_CONFLICT: 'The server already holds a different record under this capture or sequence identity.',
  CHECKPOINT_REGRESSION: 'The server checkpoint is ahead of this device; local delivery state is stale.',
  CONFLICT_UNKNOWN: 'The server refused this record with an unrecognized conflict.',
};

const ERRORS = {
  outbox_full: 'OUTBOX_FULL: capture cannot start until stored records are uploaded or exported and reset.',
  unsupported_tab: 'This tab is not an allowed Pancake origin.',
  invalid_scope: 'Fill in all four scope fields.',
  capture_scope_mismatch: 'Capture scope does not match the enrolled grant, or delivery is blocked.',
  backend_permission_required: 'Permission for the backend origin was not granted.',
  pending_outbox_binding: 'Pending records belong to another enrollment. Export or discard them via reset first.',
  blocked_requires_reset: 'This enrollment is blocked. Use Reset enrollment and obtain a new grant.',
  enrollment_required: 'Upload is not enrolled or is blocked. No retry was attempted.',
  reset_not_required: 'Reset is only available after a blocked, unauthorized, expired or disconnected enrollment, or for a local-only outbox.',
  export_required: 'Records changed since the last export, or were never exported. Export again first.',
  export_or_discard_required: 'Choose whether the pending records were exported or should be discarded.',
  discard_confirmation_required: 'Confirm the exact number of records to discard.',
  invalid_enrollment: 'Enrollment JSON is invalid or expired.',
  invalid_backend_origin: 'Backend origin must be a bare HTTPS origin.',
};

export const errorMessage = (code) => ERRORS[code] ?? 'Capture unavailable; check scope, tab, debugger permission and storage.';

export function popupView(status) {
  const blocked = status.upload === 'blocked' ? (REASONS[status.blockedReason] ? status.blockedReason : 'CONFLICT_UNKNOWN') : null;
  const resettable = ['blocked', 'unauthorized', 'expired', 'disconnected'].includes(status.upload) ||
    (status.upload === 'disabled' && status.pending > 0);
  const parts = [
    `Capture: ${status.capture}.`, `${status.pending} of ${status.limits.records} records stored.`,
    `Upload: ${status.upload}.`, `Continuity: ${status.continuity}.`,
  ];
  if (status.dropped) parts.push(`${status.dropped} refused at capacity.`);
  if (status.drift) parts.push(`${status.drift.count} unrecognized frame shapes.`);
  return {
    summary: parts.join(' '),
    blocked, blockedText: blocked ? `${blocked}: ${REASONS[blocked]}` : '',
    full: status.capture === 'OUTBOX_FULL', reset: resettable, pending: status.pending, exported: status.exported,
    drift: status.drift ? `${status.drift.count} frames did not match the allowlist (${status.drift.samples.length} distinct shapes` +
      `${status.drift.overflow ? `, ${status.drift.overflow} more not sampled` : ''}). Fingerprints: ` +
      status.drift.samples.map((sample) => `${sample.kind} ${sample.fingerprint} x${sample.count}`).join('; ') +
      '. Only structural hashes are kept; no values. Report this to the platform team; capture contract may need review.' : '',
  };
}
