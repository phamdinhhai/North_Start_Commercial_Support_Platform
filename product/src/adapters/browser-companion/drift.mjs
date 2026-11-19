// Schema-drift monitoring. Only a structural fingerprint (hash of key/type skeleton) is retained, never values.

const CAPTURED = new Set(['pages:update_messages', 'pages:update_conversation', 'messages:mark_as_deleted', 'pages:tag_conversations']);
// Phoenix transport/control frames are expected on scoped topics and are neither evidence nor drift.
const CONTROL = new Set(['phx_reply', 'phx_join', 'phx_leave', 'phx_close', 'phx_error', 'heartbeat', 'presence_state', 'presence_diff']);
export const MAX_DRIFT_SAMPLES = 20;

// Keys that look like identifiers (digits, long, odd characters) are collapsed so per-object keys cannot leak or explode.
const keyToken = (key) => (/^[a-z_]{1,40}$/i.test(key) ? key : '#');
const eventToken = (event) => (typeof event === 'string' && /^[a-z_:]{1,64}$/.test(event) ? event : '#');

function skeleton(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (depth >= 4) return '[]';
    const items = [...new Set(value.slice(0, 3).map((item) => JSON.stringify(skeleton(item, depth + 1))))].sort();
    return ['array', items.map((item) => JSON.parse(item))];
  }
  if (typeof value === 'object') {
    if (depth >= 4) return '{}';
    const entries = new Map();
    for (const key of Object.keys(value).slice(0, 64)) {
      const token = keyToken(key);
      if (!entries.has(token)) entries.set(token, skeleton(value[key], depth + 1));
    }
    return Object.fromEntries([...entries].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)));
  }
  return typeof value;
}

/**
 * Classify a frame that the value allowlist did NOT turn into an observation.
 * Returns null for expected non-evidence (control frames, other page topics), otherwise a drift descriptor.
 */
export function classifyRejectedFrame(raw, pageId) {
  if (typeof raw !== 'string') return null;
  let frame;
  try { frame = JSON.parse(raw); } catch { return { kind: 'unparseable', shape: ['text'] }; }
  if (!Array.isArray(frame) || frame.length !== 5) return { kind: 'unexpected-envelope', shape: skeleton(frame) };
  const [, , topic, event, payload] = frame;
  if (typeof topic !== 'string' || topic !== `pages:${pageId}`) return null; // foreign/other channels: scope filter, not drift
  if (CONTROL.has(event)) return null;
  const kind = CAPTURED.has(event) ? 'rejected-shape' : 'unknown-event';
  return { kind, shape: [eventToken(event), skeleton(payload)] };
}

export async function shapeFingerprint(descriptor) {
  const bytes = new TextEncoder().encode(JSON.stringify([descriptor.kind, descriptor.shape]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 12), (value) => value.toString(16).padStart(2, '0')).join('');
}

/** Bounded local drift counter: total count, up to MAX_DRIFT_SAMPLES distinct fingerprints, overflow counter. */
export function recordDrift(state, fingerprint, kind, at) {
  const drift = state.drift ?? { count: 0, overflow: 0, samples: [] };
  const samples = drift.samples.map((sample) => (sample.fingerprint === fingerprint ? { ...sample, count: sample.count + 1, lastSeenAt: at } : sample));
  const known = drift.samples.some((sample) => sample.fingerprint === fingerprint);
  let overflow = drift.overflow ?? 0;
  if (!known) {
    if (samples.length < MAX_DRIFT_SAMPLES) samples.push({ fingerprint, kind, count: 1, firstSeenAt: at, lastSeenAt: at });
    else overflow += 1;
  }
  return { ...state, drift: { count: drift.count + 1, overflow, samples } };
}
