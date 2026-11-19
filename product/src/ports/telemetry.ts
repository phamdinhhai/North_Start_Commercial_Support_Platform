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
export interface LearningTelemetryPort { recordLearning(input: RecordEventInput): Promise<ProductEvent> }
export const LEARNING_TELEMETRY_SERVICE = Symbol('LEARNING_TELEMETRY_SERVICE');
