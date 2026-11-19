export const DATA_LIFECYCLE_STORE = Symbol('DATA_LIFECYCLE_STORE');
export type LifecycleDataClass = 'accepted_evidence' | 'audit';
export interface LifecyclePolicyInput {
  readonly dataClass: LifecycleDataClass;
  readonly retentionSeconds: number;
  /** Opaque reviewed schedule reference; never erasure authorization. */
  readonly approvalRef: string;
  readonly expectedRevision: number;
}
export interface LifecyclePolicy extends LifecyclePolicyInput { readonly revision: number }
export interface LifecyclePreview {
  readonly id: string;
  readonly dataClass: LifecycleDataClass;
  readonly policyRevision: number;
  readonly asOf: string;
  readonly eligibleCount: number;
  readonly disposition: 'BLOCKED_IMMUTABLE_HISTORY';
  readonly executionAvailable: false;
}
export interface DataLifecycleStore {
  configure(workspaceId: string, actorId: string, input: LifecyclePolicyInput): Promise<LifecyclePolicy>;
  preview(workspaceId: string, actorId: string, dataClass: LifecycleDataClass): Promise<LifecyclePreview>;
}
export class DataLifecycleError extends Error {
  constructor(readonly code: 'FORBIDDEN' | 'INVALID_INPUT' | 'REVISION_CONFLICT' | 'POLICY_REQUIRED', readonly status: number) { super(code); }
}
