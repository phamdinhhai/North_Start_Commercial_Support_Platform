import type { PancakeConnectionReference, PancakeCursor, PancakeReadResult } from '../adapters/pancake/pancake.types';

/** Framework-neutral, read-only boundary for a future Pancake provider. */
export interface PancakeReadPort {
  read(connection: PancakeConnectionReference, cursor?: PancakeCursor): Promise<PancakeReadResult>;
}
