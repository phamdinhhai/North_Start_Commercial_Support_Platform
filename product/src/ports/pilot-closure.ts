import type { ContentDigest } from './content-digester';
import type { PilotLoopState, PilotQueueQuery } from './pilot-loop.types';
export type PilotClassification = 'real' | 'synthetic' | 'all';
export interface ContextRevision { readonly id: string; readonly text: string; readonly actor: string; readonly recordedAt: string; readonly reason: string }
export interface ClosureCommandRecord { readonly idempotencyKey: string; readonly actor: string; readonly operation: string; readonly digest: ContentDigest; readonly result: Record<string, unknown> }
export interface ClosureState { readonly contextRevisions?: readonly ContextRevision[]; readonly closureCommands?: readonly ClosureCommandRecord[] }
export interface PilotLeadQuery extends Pick<PilotQueueQuery, 'workspaceId' | 'actorId' | 'actorRole'> { readonly classification?: PilotClassification; readonly limit?: number; readonly after?: string }
export interface PilotLeadPage { readonly items: readonly { readonly leadId: string; readonly displayName: string; readonly status: string; readonly ownerUserId?: string; readonly version: number; readonly isSynthetic: boolean | null; readonly currentContext: string | null }[]; readonly nextCursor?: string }
export interface PilotAssigneeDirectory { list(workspaceId: string): Promise<readonly { userId: string; role: string }[]> }
export const PILOT_ASSIGNEE_DIRECTORY = Symbol('PILOT_ASSIGNEE_DIRECTORY');
export function isSynthetic(state: PilotLoopState): boolean | null { return state.envelope?.isSynthetic ?? null; }
export function classificationMatches(synthetic: boolean | null, classification: PilotClassification = 'real'): boolean { return classification === 'all' || synthetic === (classification === 'synthetic'); }
export function leadPage(states: readonly PilotLoopState[], query: PilotLeadQuery): PilotLeadPage {
  const limit = query.limit ?? 50;
  const selected = states.filter(s => s.lead.workspaceId === query.workspaceId && classificationMatches(isSynthetic(s), query.classification)
    && (query.actorRole === 'admin' || query.actorRole === 'manager' || s.ownerUserId === query.actorId || s.workItems.some(w => w.actor === query.actorId && ['proposed','accepted','open','awaiting-external'].includes(w.status)))
    && (!query.after || s.lead.id > query.after)).sort((a,b) => a.lead.id.localeCompare(b.lead.id));
  const items = selected.slice(0, limit).map(s => ({leadId:s.lead.id,displayName:s.lead.displayName,status:s.lead.status,ownerUserId:s.ownerUserId,version:s.version ?? 0,isSynthetic:isSynthetic(s),currentContext:s.contextRevisions?.at(-1)?.text ?? s.handoff?.context ?? null}));
  return {items,...(selected.length > limit ? {nextCursor:items.at(-1)!.leadId} : {})};
}
