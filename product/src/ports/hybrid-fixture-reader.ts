import type {IntegrationScope} from './integration';
export const HYBRID_FIXTURE_READER = Symbol('HYBRID_FIXTURE_READER');
/** Only the composition root supplies this reader; clients cannot submit API authority. */
export interface HybridFixtureReader {
  read(scope: IntegrationScope): Promise<{native: Readonly<Record<string,string>>; facts?: Readonly<Record<string,string>>}>;
}
