import type { ContentDigest } from './content-digester';
import { validId, type Observation } from './observation';
import { observePhoenixFrame, type CaptureContext, type FrameResult } from './phoenix-observer';

/**
 * Synthetic-contract lifecycle layer over the inherited Phoenix observer.
 * Evidence level: SOURCE_INSPECTED event names, SYNTHETIC_TESTED payload shapes.
 * Nothing here is a CommercialEvent, Lead state or verified provider outcome (I-04, I-10, I-11, I-12).
 * OPEN: CE-2 - message lifecycle labels are transport observations, not canonical event scope.
 */

/** Source-inspected label (facebook-settings-static-evidence.json); payload shape is a synthetic assumption. */
export const READ_STATE_EVENT = 'pages:seen_conversation';
const AUTH_EXPIRED_REASONS = new Set(['unauthorized', 'unauthenticated', 'invalid_token', 'token_expired', 'session_expired', 'expired']);
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_MESSAGES_PER_FRAME = 200;
const MAX_ATTACHMENTS_PER_MESSAGE = 50;

export interface AttachmentSummary {
  readonly count: number;
  /** Lower-case type labels only; anything else is recorded as UNKNOWN. URLs/names are never retained. */
  readonly types: readonly string[];
  /** Null when any attachment lacks a non-negative integer size. */
  readonly totalBytes: number | null;
}

export interface MessageMetadata {
  readonly providerMessageId: string;
  readonly conversationId: string;
  readonly pageId: string;
  readonly hasText: boolean;
  readonly attachments: AttachmentSummary;
  /**
   * ADR-009 keyed HMAC (workspace key, `kid` recorded) of the provider message object. Used only to compare
   * re-observations under the same kid; never identity, never an unkeyed hash of message text.
   */
  readonly contentDigest: ContentDigest;
}

export type LifecycleLabel = 'upsert-observed' | 'deletion-labelled';

export interface SchemaDriftRecord {
  readonly quarantined: true;
  readonly reason: 'unknown_event' | 'unknown_shape';
  readonly eventType: string;
  readonly topic: string;
  /** Bounded, pattern-filtered top-level key names; never values. */
  readonly payloadKeys: readonly string[];
  readonly payloadKeyCount: number;
  /** Keyed digest only; the quarantined raw frame itself is never retained (ADR-009 §3). */
  readonly payloadDigest: ContentDigest;
  readonly captureId: string;
  readonly observedAt: string;
  readonly semantics: 'UNKNOWN';
}

/**
 * 'reply-ok' is any successful Phoenix reply (heartbeat, push or join). Only join-tracker.ts may
 * upgrade it to 'joined', after matching (topic, join_ref, ref) of an outbound phx_join (R2-I-03).
 */
export type TransportSignal = 'joined' | 'reply-ok' | 'join-rejected' | 'auth-expired' | 'channel-closed' | 'channel-error' | 'heartbeat' | 'other';

export type LifecycleResult =
  | { readonly kind: 'message-metadata'; readonly label: LifecycleLabel; readonly observation: Observation; readonly messages: readonly MessageMetadata[] }
  | { readonly kind: 'read-state'; readonly observation: Observation; readonly conversationId: string; readonly seen: boolean | 'UNKNOWN' }
  | { readonly kind: 'conversation-metadata'; readonly observation: Observation }
  | { readonly kind: 'schema-drift'; readonly drift: SchemaDriftRecord; readonly observation: Observation | null }
  | { readonly kind: 'transport'; readonly eventType: string; readonly signal: TransportSignal; readonly topic: string; readonly joinRef: string | null; readonly ref: string | null }
  | Extract<FrameResult, { kind: 'ignored' | 'rejected' }>;

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);

/** Classify one received frame. Never returns message bodies, attachment URLs or credentials. */
export function classifyLifecycleFrame(raw: string, context: CaptureContext): LifecycleResult {
  const base = observePhoenixFrame(raw, context);
  if (base.kind === 'rejected') return base;
  if (base.kind === 'ignored' && base.reason === 'outbound_frame') return base;
  // Base accepted structure, size and topic scope before any of the branches below.
  const [joinRef, ref, topic, event, payload] = JSON.parse(raw) as [string | null, string | null, string, string, Json];
  const drift = (reason: SchemaDriftRecord['reason'], observation: Observation | null = null): LifecycleResult =>
    ({ kind: 'schema-drift', observation, drift: driftRecord(reason, raw, topic, event, payload, context) });
  if (base.kind === 'control') return { kind: 'transport', eventType: event, signal: transportSignal(event, payload), topic, joinRef, ref };
  if (base.kind === 'ignored') {
    if (event === READ_STATE_EVENT && topic !== 'phoenix') {
      if (payload.page_id != null && payload.page_id !== topic.slice(6)) return { kind: 'rejected', reason: 'scope_mismatch' };
      return readState(raw, payload, context) ?? drift('unknown_shape');
    }
    return drift('unknown_event');
  }
  const observation = base.observation;
  const pageId = topic.slice(6);
  if (event === 'pages:update_messages') {
    const messages = extractMessages(payload.messages, observation.externalObjectId, pageId, digestMessage(context));
    return messages ? { kind: 'message-metadata', label: 'upsert-observed', observation, messages } : drift('unknown_shape', observation);
  }
  if (event === 'messages:mark_as_deleted') {
    // Deletion without a message identity cannot be attributed to a message; quarantine instead of guessing.
    const messages = isRecord(payload.message) ? extractMessages([payload.message], observation.externalObjectId, pageId, digestMessage(context)) : null;
    return messages ? { kind: 'message-metadata', label: 'deletion-labelled', observation, messages } : drift('unknown_shape', observation);
  }
  return { kind: 'conversation-metadata', observation };
}

/**
 * Map a transport signal to a continuity lifecycle input. A matched join ACK reconnects one page but never
 * closes a gap; an unmatched 'reply-ok' (e.g. heartbeat reply) changes nothing.
 */
export function transportSignalToInput(signal: TransportSignal, at: string, pageId: string | null = null):
  { readonly kind: 'connected' | 'disconnected' | 'auth-expired'; readonly at: string; readonly pageId?: string } | null {
  if (signal === 'joined') return pageId === null ? { kind: 'connected', at } : { kind: 'connected', at, pageId };
  if (signal === 'auth-expired') return { kind: 'auth-expired', at };
  if (signal === 'channel-closed' || signal === 'channel-error' || signal === 'join-rejected') return { kind: 'disconnected', at };
  return null;
}

function transportSignal(event: string, payload: Json): TransportSignal {
  if (event === 'heartbeat') return 'heartbeat';
  if (event === 'phx_close') return 'channel-closed';
  if (event === 'phx_error') return 'channel-error';
  if (event !== 'phx_reply') return 'other';
  if (payload.status === 'ok') return 'reply-ok';
  if (payload.status !== 'error') return 'other';
  // Synthetic assumption: the live auth-expiry frame shape is unverified (BLOCKED on authorized account).
  const reason = isRecord(payload.response) ? payload.response.reason : undefined;
  return typeof reason === 'string' && AUTH_EXPIRED_REASONS.has(reason.toLowerCase()) ? 'auth-expired' : 'join-rejected';
}

const digestMessage = (context: CaptureContext) => (message: Json): ContentDigest =>
  context.digester.digest(context.scope.workspaceId, 'message', JSON.stringify(message));

function extractMessages(value: unknown, conversationId: string | null, pageId: string,
  digest: (message: Json) => ContentDigest): MessageMetadata[] | null {
  if (!conversationId || !Array.isArray(value) || !value.length || value.length > MAX_MESSAGES_PER_FRAME) return null;
  const result: MessageMetadata[] = [];
  for (const message of value) {
    if (!isRecord(message) || !validId(message.id)) return null;
    if (message.conversation_id != null && message.conversation_id !== conversationId) return null;
    if (message.page_id != null && message.page_id !== pageId) return null;
    const attachments = summarizeAttachments(message.attachments);
    if (!attachments) return null;
    result.push({
      providerMessageId: message.id, conversationId, pageId, attachments,
      hasText: typeof message.message === 'string' && message.message.length > 0,
      contentDigest: digest(message),
    });
  }
  return new Set(result.map((item) => item.providerMessageId)).size === result.length ? result : null;
}

function summarizeAttachments(value: unknown): AttachmentSummary | null {
  if (value == null) return { count: 0, types: [], totalBytes: 0 };
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS_PER_MESSAGE || !value.every(isRecord)) return null;
  let totalBytes: number | null = 0;
  const types = new Set<string>();
  for (const item of value as Json[]) {
    types.add(typeof item.type === 'string' && /^[a-z_]{1,32}$/.test(item.type) ? item.type : 'UNKNOWN');
    const size = item.size;
    totalBytes = totalBytes !== null && Number.isSafeInteger(size) && (size as number) >= 0 ? totalBytes + (size as number) : null;
  }
  return { count: value.length, types: [...types].sort(), totalBytes };
}

function readState(raw: string, payload: Json, context: CaptureContext): LifecycleResult | null {
  const conversationId = payload.conversation_id;
  if (!validId(conversationId) || (payload.seen != null && typeof payload.seen !== 'boolean')) return null;
  const observation: Observation = {
    scope: { ...context.scope }, captureId: context.captureId, sourceRevision: context.sourceRevision,
    externalEventId: null, externalObjectId: conversationId, eventType: READ_STATE_EVENT,
    method: 'browser-websocket', evidenceType: 'client-observed', authenticity: 'UNKNOWN', completeness: 'UNKNOWN',
    occurredAt: null, observedAt: context.observedAt, payloadDigest: context.digester.digest(context.scope.workspaceId, 'frame', raw),
  };
  // Provider seen/unread is a UI flag. It never maps to Lead state, obligation state or a response SLA.
  return { kind: 'read-state', observation, conversationId, seen: typeof payload.seen === 'boolean' ? payload.seen : 'UNKNOWN' };
}

function driftRecord(reason: SchemaDriftRecord['reason'], raw: string, topic: string, event: string, payload: Json, context: CaptureContext): SchemaDriftRecord {
  const keys = Object.keys(payload);
  return {
    quarantined: true, reason, eventType: event, topic,
    payloadKeys: keys.filter((key) => KEY_PATTERN.test(key)).sort().slice(0, 32), payloadKeyCount: keys.length,
    payloadDigest: context.digester.digest(context.scope.workspaceId, 'frame', raw), captureId: context.captureId, observedAt: context.observedAt, semantics: 'UNKNOWN',
  };
}
