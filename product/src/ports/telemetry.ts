export interface ProductEvent {
  readonly id: string;
  readonly workspaceId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly releaseVersion: string;
  readonly flagExposure: Record<string, string>;
  readonly createdAt: string;
}

export interface RecordEventInput {
  readonly workspaceId: string;
  readonly eventType: string;
  readonly payload?: Record<string, unknown>;
  readonly releaseVersion?: string;
  readonly flagExposure?: Record<string, string>;
}

export interface TelemetryServicePort {
  record(input: RecordEventInput): Promise<ProductEvent>;
  listByWorkspace(workspaceId: string): Promise<readonly ProductEvent[]>;
}

export const TELEMETRY_SERVICE = Symbol('TELEMETRY_SERVICE');
/** Reviewed categorical behavior vocabulary; never evidence or commercial truth. */
export const LEARNING_EVENT_TYPES: ReadonlySet<string> = new Set([
  'lead_opened', 'evidence_viewed', 'context_edited', 'handoff_started', 'handoff_created', 'handoff_accepted',
  'contact_attempt_recorded', 'action_created', 'action_completed', 'action_rescheduled', 'action_reopened',
  'outcome_recorded', 'outcome_corrected', 'workflow_error', 'workflow_recovered',
]);
export interface LearningTelemetryPort { recordLearning(input: RecordEventInput): Promise<ProductEvent> }
export const LEARNING_TELEMETRY_SERVICE = Symbol('LEARNING_TELEMETRY_SERVICE');
