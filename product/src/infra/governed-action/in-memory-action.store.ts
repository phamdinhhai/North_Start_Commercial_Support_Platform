import { deepFreeze } from '../../domain/governed-action/canonical-json';
import {
  GovernedActionError, type ActionEvent, type ActionProposal, type Transition,
} from '../../domain/governed-action/governed-action.types';
import type { ActionStore, CreateResult } from '../../ports/governed-action';

const key = (workspaceId: string, id: string) => `${workspaceId}\u0000${id}`;
const clone = <T>(value: T): T => deepFreeze(structuredClone(value));

/**
 * In-memory ActionStore for tests / local synthetic runs. Same contract as the PostgreSQL
 * store: workspace-scoped reads, (workspace, requestKey) uniqueness, CAS on version,
 * append-only events (no API exists to update or delete an event).
 */
export class InMemoryActionStore implements ActionStore {
  private readonly proposals = new Map<string, ActionProposal>();
  private readonly requestKeys = new Map<string, string>();
  private readonly log = new Map<string, ActionEvent[]>();

  async create(t: Transition): Promise<CreateResult> {
    const { proposal, event } = t;
    if (proposal.version !== 1 || event.sequence !== 1) throw new GovernedActionError('INVALID_INPUT', 'new proposals start at version 1');
    const existingId = this.requestKeys.get(key(proposal.workspaceId, proposal.requestKey));
    if (existingId) return { created: false, proposal: clone(this.proposals.get(key(proposal.workspaceId, existingId))!) };
    if (this.proposals.has(key(proposal.workspaceId, proposal.id))) throw new GovernedActionError('INVALID_INPUT', 'duplicate proposal id');
    this.proposals.set(key(proposal.workspaceId, proposal.id), clone(proposal));
    this.requestKeys.set(key(proposal.workspaceId, proposal.requestKey), proposal.id);
    this.log.set(key(proposal.workspaceId, proposal.id), [clone(event)]);
    return { created: true, proposal: clone(proposal) };
  }

  async get(workspaceId: string, proposalId: string): Promise<ActionProposal | undefined> {
    const p = this.proposals.get(key(workspaceId, proposalId));
    return p ? clone(p) : undefined;
  }

  async transition(expectedVersion: number, t: Transition): Promise<void> {
    const k = key(t.proposal.workspaceId, t.proposal.id);
    const current = this.proposals.get(k);
    if (!current) throw new GovernedActionError('NOT_FOUND', 'proposal not found');
    if (current.version !== expectedVersion || t.proposal.version !== expectedVersion + 1 || t.event.sequence !== t.proposal.version) {
      throw new GovernedActionError('CONCURRENT_MODIFICATION', 'proposal was modified concurrently');
    }
    if (current.argumentDigest !== t.proposal.argumentDigest || current.canonicalArguments !== t.proposal.canonicalArguments) {
      throw new GovernedActionError('DIGEST_MISMATCH', 'frozen arguments are immutable');
    }
    this.proposals.set(k, clone(t.proposal));
    this.log.get(k)!.push(clone(t.event));
  }

  async events(workspaceId: string, proposalId: string): Promise<ActionEvent[]> {
    return (this.log.get(key(workspaceId, proposalId)) ?? []).map(clone);
  }
}
