import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { PostgresService } from '../postgres/postgres.service';
import type { FeedbackServicePort, Feedback, SubmitFeedbackInput } from '../../ports/feedback';
export type { Feedback, SubmitFeedbackInput } from '../../ports/feedback';

/**
 * Structured feedback (R-23, C-08) — tách khỏi telemetry (R-21/R-22).
 * Feedback là product signal, không phải demand proof; gắn workspace + optional lead + actor.
 */
interface FeedbackDbRow extends QueryResultRow {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  actor: string;
  rating: number | null;
  body: string | null;
  context: Record<string, unknown>;
  created_at: Date | string;
}

const COLUMNS = 'id, workspace_id, lead_id, actor, rating, body, context, created_at';

@Injectable()
export class FeedbackService implements FeedbackServicePort {
  constructor(private readonly db: PostgresService) {}

  async submit(input: SubmitFeedbackInput): Promise<Feedback> {
    if (!input.workspaceId) throw new Error('workspaceId is required');
    if (!input.actor) throw new Error('actor is required');
    if (input.rating !== undefined && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) {
      throw new Error('rating must be an integer 1-5');
    }
    if (input.leadId) {
      const workspaceCheck = await this.db.query<{ workspace_id: string }>(
        'SELECT workspace_id FROM lead WHERE id = $1',
        [input.leadId],
      );
      const leadWorkspace = workspaceCheck.rows[0]?.workspace_id;
      if (!leadWorkspace) throw new Error('lead not found');
      if (leadWorkspace !== input.workspaceId) throw new Error('lead workspace mismatch');
    }
    const result = await this.db.query<FeedbackDbRow>(
      `INSERT INTO feedback (workspace_id, lead_id, actor, rating, body, context)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING ${COLUMNS}`,
      [
        input.workspaceId,
        input.leadId ?? null,
        input.actor,
        input.rating ?? null,
        input.body ?? null,
        JSON.stringify(input.context ?? {}),
      ],
    );
    return toFeedback(result.rows[0]);
  }

  async listByWorkspace(workspaceId: string): Promise<readonly Feedback[]> {
    const result = await this.db.query<FeedbackDbRow>(
      `SELECT ${COLUMNS} FROM feedback WHERE workspace_id = $1 ORDER BY created_at`,
      [workspaceId],
    );
    return result.rows.map(toFeedback);
  }
}

function toFeedback(r: FeedbackDbRow): Feedback {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    leadId: r.lead_id,
    actor: r.actor,
    rating: r.rating,
    body: r.body,
    context: r.context,
    createdAt: new Date(r.created_at).toISOString(),
  };
}
