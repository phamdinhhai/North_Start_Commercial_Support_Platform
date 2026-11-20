import type { SourceObservation } from '../../ports/source-observation';

export const META_SYNTHETIC_FIXTURE = {
  schemaVersion: 1, synthetic: true, receiptId: 'synthetic-meta-receipt',
  displayName: 'Fabricated Meta customer', observedAt: '2026-11-20T00:00:00.000Z',
  payload: { object: 'page', entry: [{ id: 'synthetic-page', time: 1795132800000,
    messaging: [{ sender: { id: 'synthetic-sender' }, recipient: { id: 'synthetic-page' },
      timestamp: 1795132800000, message: { mid: 'synthetic-message', text: 'Fabricated Meta enquiry' } }] }] },
} as const;

/** A fabricated envelope shaped like Messenger's incoming text payload, never HTTP intake. */
export class MetaFixtureError extends Error {
  constructor(readonly code: 'INVALID_FIXTURE' | 'PAGE_MISMATCH') { super(code); }
}
const invalid = (): never => { throw new MetaFixtureError('INVALID_FIXTURE'); };
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !keys.includes(key))) return invalid();
  return result;
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/u.test(value)) return invalid();
  return value;
}
function milliseconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 8640000000000000) return invalid();
  return value;
}
function singleton(value: unknown): unknown {
  if (!Array.isArray(value) || value.length !== 1) return invalid();
  return value[0];
}

/** ADR-005/007: no credentials, provider calls, business assertions or identity inference. */
export function decodeMetaSynthetic(input: unknown, expectedPageId?: string): SourceObservation {
  const fixture = record(input, ['schemaVersion', 'synthetic', 'receiptId', 'observedAt', 'displayName', 'syntheticLinkage', 'payload']);
  if (fixture.schemaVersion !== 1 || fixture.synthetic !== true) return invalid();
  const receiptId = text(fixture.receiptId);
  const displayName = text(fixture.displayName);
  const observedAt = text(fixture.observedAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(observedAt) || !Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt) return invalid();
  let conversationId: string | null = null;
  if (fixture.syntheticLinkage !== undefined) {
    const linkage = record(fixture.syntheticLinkage, ['conversationId', 'disclosure']);
    if (linkage.disclosure !== 'fabricated_fixture_linkage') return invalid();
    conversationId = text(linkage.conversationId);
  }
  const payload = record(fixture.payload, ['object', 'entry']);
  if (payload.object !== 'page') return invalid();
  const entry = record(singleton(payload.entry), ['id', 'time', 'messaging']);
  const pageId = text(entry.id);
  milliseconds(entry.time);
  const event = record(singleton(entry.messaging), ['sender', 'recipient', 'timestamp', 'message']);
  const sender = record(event.sender, ['id']);
  const recipient = record(event.recipient, ['id']);
  text(sender.id);
  const recipientId = text(recipient.id);
  if ((expectedPageId !== undefined && pageId !== text(expectedPageId)) || recipientId !== pageId || sender.id === pageId) throw new MetaFixtureError('PAGE_MISMATCH');
  const occurredAt = new Date(milliseconds(event.timestamp)).toISOString();
  const message = record(event.message, ['mid', 'text']);
  const messageId = text(message.mid);
  const utterance = text(message.text, 10000);
  return {
    schemaVersion: 1, provider: 'meta-page', route: 'meta-page-synthetic', synthetic: true,
    sourceAuthority: 'synthetic_fixture', completeness: 'UNKNOWN', verification: 'UNVERIFIED',
    receiptId, accountId: pageId, native: { system: 'meta', pageId, conversationId, messageId, eventId: null, revision: null },
    observedAt, occurredAt, lifecycle: 'upsert-observed', displayName,
    // Accepted fabricated raw is detached from caller mutations; no content digest (ADR-009).
    rawPayload: { utterance, speaker: 'customer', original: structuredClone(fixture) },
  };
}

