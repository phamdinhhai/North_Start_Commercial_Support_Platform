import type { AuthContext } from '../../ports/auth';
import { SourceIntegrationError, type SourceConnection, type SourceIntegrationStore, type SourceEvidencePageOptions, type SourceEvidence } from '../../ports/source-observation';
import { validateSourceObservation } from './validation';
import { assertSyntheticNativeIdentity, assertSyntheticSourceAdmission, projectSourceTrust } from '../source-trust/source-trust';

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
  async connection(ctx: AuthContext, id: string) {
    this.admin(ctx);
    const connection = this.store.getConnection ? await this.store.getConnection(ctx.workspaceId,id) :
      (await this.store.listConnections(ctx.workspaceId)).find(c => c.id === id);
    if (!connection) throw new SourceIntegrationError('CONNECTION_NOT_FOUND',404);
    return connection;
  }
  async intake(ctx: AuthContext, connectionId: string, value: unknown, options: {claimResponsibility:boolean} = {claimResponsibility:false}) {
    this.admin(ctx);
    if (!options || Object.keys(options).join() !== 'claimResponsibility' || typeof options.claimResponsibility !== 'boolean') throw new SourceIntegrationError('INPUT_INVALID',400);
    const observation=validateSourceObservation(value);
    assertSyntheticNativeIdentity(observation);
    const connection=await this.connection(ctx,connectionId);
    assertSyntheticSourceAdmission(observation,{workspaceId:ctx.workspaceId,connection});
    return this.store.intake(ctx,connectionId,observation,options);
  }
  async evidence(ctx: AuthContext, leadId: string, options: SourceEvidencePageOptions = {}) {
    this.gate();
    await this.authorizeLead(ctx,leadId);
    const page=this.store.evidencePage ? await this.store.evidencePage(ctx.workspaceId,leadId,ctx.userId,options) :
      {items:await this.store.evidence(ctx.workspaceId,leadId,ctx.userId),nextCursor:null};
    return {items:page.items.map(sourceEvidenceView),limit:this.store.evidencePage?(options.limit??20):100,
      nextCursor:page.nextCursor,possiblyTruncated:page.nextCursor!==null || (!this.store.evidencePage&&page.items.length===100),
      verification:'UNVERIFIED' as const,completeness:'UNKNOWN' as const};
  }
}

/** Explicit allowlist: neither original wrappers nor keyed content digests leave the service. */
export function sourceEvidenceView({receipt,observation,envelope}:SourceEvidence) {
    return {receipt,observation,trust:projectSourceTrust(observation),envelope:{
      envelopeId:envelope.envelopeId,connection:envelope.connection,externalRecordId:envelope.externalRecordId,
      sourceCapturedAt:envelope.sourceCapturedAt,ingestedAt:envelope.ingestedAt,isSynthetic:true,
      acquisitionMode:envelope.acquisitionMode,acquisitionSource:envelope.acquisitionSource,
      rawPayload:{utterance:(envelope.rawPayload as SourceRaw).utterance,speaker:(envelope.rawPayload as SourceRaw).speaker},
    }};
}
type SourceRaw = {utterance:string;speaker:string};
