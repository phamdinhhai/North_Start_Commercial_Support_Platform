import type { AuthContext } from '../../ports/auth';
import { SourceIntegrationError, type SourceConnection, type SourceIntegrationStore } from '../../ports/source-observation';
import { validateSourceObservation } from './validation';

/** ADR-006/007: explicit admin simulation, no transport credentials or live capabilities. */
export class SourceIntegrationService {
  constructor(private readonly store: SourceIntegrationStore,
    private readonly authorizeLead: (ctx: AuthContext, leadId: string) => Promise<unknown>,
    private readonly enabled = false) {}
  private gate() { if (!this.enabled) throw new SourceIntegrationError('SOURCE_INTEGRATION_DISABLED', 404); }
  private admin(ctx: AuthContext) {
    this.gate();
    if (!ctx || !ctx.userId || !ctx.workspaceId) throw new SourceIntegrationError('UNAUTHORIZED', 401);
    if (ctx.isDemo || ctx.role !== 'admin') throw new SourceIntegrationError('FORBIDDEN', 403);
  }
  async createConnection(ctx: AuthContext, input: Pick<SourceConnection, 'provider' | 'route' | 'pageId'>) {
    this.admin(ctx);
    if (!input || Object.keys(input).sort().join() !== 'pageId,provider,route' ||
      !['pancake','meta-page'].includes(input.provider) || input.route !== `${input.provider}-synthetic` ||
      typeof input.pageId !== 'string' || !input.pageId || input.pageId.length > 256 || /[\x00-\x1f\x7f]/.test(input.pageId))
      throw new SourceIntegrationError('INPUT_INVALID',400);
    return this.store.createConnection(ctx,input);
  }
  async revokeConnection(ctx: AuthContext, id: string) { this.admin(ctx); return this.store.revokeConnection(ctx,id); }
  async listConnections(ctx: AuthContext) { this.admin(ctx); return this.store.listConnections(ctx.workspaceId); }
  async intake(ctx: AuthContext, connectionId: string, value: unknown) {
    this.admin(ctx);
    return this.store.intake(ctx,connectionId,validateSourceObservation(value));
  }
  async evidence(ctx: AuthContext, leadId: string) {
    this.gate();
    await this.authorizeLead(ctx,leadId);
    return {items:await this.store.evidence(ctx.workspaceId,leadId,ctx.userId),verification:'UNVERIFIED' as const,completeness:'UNKNOWN' as const};
  }
}
