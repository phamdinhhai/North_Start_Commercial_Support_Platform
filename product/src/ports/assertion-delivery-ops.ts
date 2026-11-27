import type { AuthContext } from './auth';

export const ASSERTION_DELIVERY_OPS = Symbol('ASSERTION_DELIVERY_OPS');
export interface AssertionDeliveryOperations {
  inspect(ctx: AuthContext | null): Promise<readonly {
    assertionId: string; status: 'PENDING' | 'LEASED' | 'DELIVERED' | 'FAILED';
    attempts: number; nextAttemptAt: string; lastError: string | null;
  }[]>;
  change(ctx: AuthContext | null, assertionId: string, operation: 'replay' | 'stop'): Promise<{ assertionId: string; operation: 'replay' | 'stop' }>;
}
export class AssertionOpsError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
