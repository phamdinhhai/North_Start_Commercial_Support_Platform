import type { SourceObservation, SourceProvider } from './source-observation';
/** Offline mapping only. The connection chooses the provider; caller cannot select authority. */
export interface SourceFixtureDecoder {
  decode(provider: SourceProvider, input: unknown): SourceObservation;
  example(provider: SourceProvider): unknown;
}
export const SOURCE_FIXTURE_DECODER = Symbol('SOURCE_FIXTURE_DECODER');
export const SOURCE_SYNTHETIC_MODE = Symbol('SOURCE_SYNTHETIC_MODE');
