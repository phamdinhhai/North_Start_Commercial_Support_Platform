import { createHash } from 'node:crypto';
import { validId, validTime } from './observation';
import { collectionKey, type ReadbackAnalysis } from './history-readback';
import type { LiveMessage } from './message-ledger';
import type { GapWindow } from './continuity';

/**
 * Live-observation vs readback correlation. Pure and synthetic-contract only.
 * Equal sets never mean "no events lost": intermediate edits, deletions and A->B->A
 * transitions are invisible to a current-state snapshot.
 */
export interface Correlation {
  readonly pageId: string;
  readonly conversationId: string;
  readonly confirmed: readonly string[];
  /** Readback IDs the observer never saw live: gap evidence (or history older than observation start). */
  readonly missingFromLive: readonly string[];
  /** Live IDs absent from a contiguous, stable readback that started after their sighting: possible deletion or instability. */
  readonly missingFromReadback: readonly string[];
  readonly deletionLabelledMissingFromReadback: readonly string[];
  /** Live IDs whose absence cannot be judged (readback partial, or sighting after readback started). */
  readonly unknown: readonly string[];
  readonly setsEqual: boolean;
  readonly eventsLost: 'UNKNOWN';
  readonly readbackCoverage: ReadbackAnalysis['coverage'];
}

export function correlateLiveWithReadback(live: readonly LiveMessage[], analysis: ReadbackAnalysis): Correlation {
  collectionKey(analysis.collection);
  const { pageId, conversationId, kind } = analysis.collection;
  if (kind !== 'messages' || conversationId === null) throw new Error('invalid_collection');
  if (!Array.isArray(live) || !live.every((item) => item && validId(item.providerMessageId) && validTime(item.earliestObservedAt) &&
      typeof item.deletionLabelled === 'boolean') || new Set(live.map((item) => item.providerMessageId)).size !== live.length) {
    throw new Error('invalid_live_messages');
  }
  const readback = new Set(analysis.itemIds);
  const liveIds = new Set(live.map((item) => item.providerMessageId));
  const contiguous = analysis.coverage === 'contiguous-to-terminal' && analysis.startedAt !== null;
  const missingFromReadback: string[] = [];
  const unknown: string[] = [];
  for (const item of live) {
    if (readback.has(item.providerMessageId)) continue;
    const seenBeforeReadback = contiguous && Date.parse(item.earliestObservedAt) < Date.parse(analysis.startedAt as string);
    (seenBeforeReadback ? missingFromReadback : unknown).push(item.providerMessageId);
  }
  const deleted = new Set(live.filter((item) => item.deletionLabelled).map((item) => item.providerMessageId));
  const confirmed = [...liveIds].filter((id) => readback.has(id)).sort();
  const missingFromLive = [...readback].filter((id) => !liveIds.has(id)).sort();
  return {
    pageId, conversationId, confirmed, missingFromLive,
    missingFromReadback: missingFromReadback.sort(), unknown: unknown.sort(),
    deletionLabelledMissingFromReadback: missingFromReadback.filter((id) => deleted.has(id)).sort(),
    setsEqual: missingFromLive.length === 0 && missingFromReadback.length === 0 && unknown.length === 0,
    eventsLost: 'UNKNOWN', readbackCoverage: analysis.coverage,
  };
}

export interface GapCoverageEvaluation {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  readonly readbackStartedAt: string | null;
  readonly collections: readonly string[];
}

/** Who or what produced the readback analyses (A-m8). Reader IDs must cover every analysis reader. */
export interface ReadbackProvenance {
  readonly producer: string;
  readonly readerIds: readonly string[];
}

export function validateProvenance(provenance: ReadbackProvenance): void {
  if (!provenance || !validId(provenance.producer) || !Array.isArray(provenance.readerIds) || !provenance.readerIds.length ||
      provenance.readerIds.length > 64 || !provenance.readerIds.every(validId)) throw new Error('invalid_provenance');
}

/** Deterministic sha256 over the analysis as produced by analyzeReadback (fixed key order). */
export function analysisDigest(analysis: ReadbackAnalysis): string {
  return createHash('sha256').update(JSON.stringify(analysis), 'utf8').digest('hex');
}

/**
 * A gap window may become "reconciled-by-snapshot" only when, for every page the observer had joined when
 * the gap opened (gap.requiredPages, taken from continuity state, R2-I-07), a contiguous conversation-list
 * readback and a contiguous message-history readback for every listed (and every additionally required)
 * conversation were all REQUESTED after the window ended (R2-I-06). This still is not replay.
 */
export function evaluateGapCoverage(gap: GapWindow, analyses: readonly ReadbackAnalysis[], provenance: ReadbackProvenance,
  alsoRequired: readonly { readonly pageId: string; readonly conversationId: string }[] = []): GapCoverageEvaluation {
  validateProvenance(provenance);
  if (!gap || !Array.isArray(gap.requiredPages) || !Array.isArray(analyses) || !Array.isArray(alsoRequired)) throw new Error('invalid_gap_coverage_input');
  const pageIds = gap.requiredPages;
  const reasons: string[] = [];
  if (gap.status !== 'UNKNOWN') reasons.push('gap_not_unknown');
  if (gap.end === null) reasons.push('gap_not_bounded');
  if (!pageIds.length) reasons.push('no_required_pages');
  const byKey = new Map<string, ReadbackAnalysis>();
  for (const analysis of analyses) {
    const key = collectionKey(analysis.collection);
    if (byKey.has(key)) reasons.push(`duplicate_collection:${key}`);
    byKey.set(key, analysis);
    if (!pageIds.includes(analysis.collection.pageId)) reasons.push(`unexpected_page:${analysis.collection.pageId}`);
    if (analysis.coverage !== 'contiguous-to-terminal') reasons.push(`not_contiguous:${key}`);
    if (gap.end !== null && (analysis.startedAt === null || Date.parse(analysis.startedAt) < Date.parse(gap.end))) {
      reasons.push(`started_before_gap_end:${key}`);
    }
    for (const reader of analysis.readers) if (!provenance.readerIds.includes(reader)) reasons.push(`unattributed_reader:${reader}`);
  }
  const required = new Set(alsoRequired.map((item) => collectionKey({ pageId: item.pageId, kind: 'messages', conversationId: item.conversationId })));
  for (const pageId of pageIds) {
    const list = byKey.get(collectionKey({ pageId, kind: 'conversations', conversationId: null }));
    if (!list) { reasons.push(`missing_conversation_list:${pageId}`); continue; }
    for (const conversationId of list.itemIds) required.add(collectionKey({ pageId, kind: 'messages', conversationId }));
  }
  for (const key of [...required].sort()) if (!byKey.has(key)) reasons.push(`missing_message_history:${key}`);
  const starts = analyses.map((analysis) => analysis.startedAt).filter((value): value is string => value !== null)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], readbackStartedAt: starts[0] ?? null, collections: [...byKey.keys()].sort() };
}
