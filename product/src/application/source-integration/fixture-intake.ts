import type { AuthContext } from '../../ports/auth';
import type { SourceFixtureDecoder } from '../../ports/source-fixture-decoder';
import { SourceIntegrationError } from '../../ports/source-observation';
import { SourceIntegrationService } from './source-integration.service';

/** Resolves current admin/tenant/connection before invoking an offline decoder. */
export class SourceFixtureIntake {
  constructor(private readonly service: SourceIntegrationService, private readonly decoder: SourceFixtureDecoder) {}
  async example(ctx: AuthContext, connectionId: string) {
    const connection = await this.service.connection(ctx,connectionId);
    if (connection.status !== 'active') throw new SourceIntegrationError('CONNECTION_REVOKED', 403);
    return { fixture: this.decoder.example(connection.provider), classification: 'FABRICATED_EXAMPLE_NOT_PROVIDER_EVIDENCE' };
  }
  async intake(ctx: AuthContext, connectionId: string, input: unknown) {
    const connection = await this.service.connection(ctx,connectionId);
    if (connection.status !== 'active') throw new SourceIntegrationError('CONNECTION_REVOKED', 403);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SourceIntegrationError('INPUT_INVALID', 400);
    const value = input as Record<string, unknown>;
    if (Object.keys(value).sort().join() !== 'claimResponsibility,fixture' || typeof value.claimResponsibility !== 'boolean') {
      throw new SourceIntegrationError('INPUT_INVALID', 400);
    }
    let observation;
    try { observation = this.decoder.decode(connection.provider, value.fixture); }
    catch { throw new SourceIntegrationError('SOURCE_SCHEMA_INVALID', 400); }
    return this.service.intake(ctx, connectionId, observation, { claimResponsibility: value.claimResponsibility });
  }
}
