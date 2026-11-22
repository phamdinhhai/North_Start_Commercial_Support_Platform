export interface Feedback {
  readonly id: string;
  readonly workspaceId: string;
  readonly leadId: string | null;
  readonly actor: string;
  readonly rating: number | null;
  readonly body: string | null;
  readonly context: Record<string, unknown>;
  readonly createdAt: string;
}

export interface SubmitFeedbackInput {
  readonly workspaceId: string;
  readonly actor: string;
  readonly leadId?: string;
  readonly rating?: number;
  readonly body?: string;
  readonly context?: Record<string, unknown>;
}

export interface FeedbackServicePort {
  submit(input: SubmitFeedbackInput): Promise<Feedback>;
  listByWorkspace(workspaceId: string): Promise<readonly Feedback[]>;
}

export const FEEDBACK_SERVICE = Symbol('FEEDBACK_SERVICE');
