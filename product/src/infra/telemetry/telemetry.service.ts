import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { PostgresService } from '../postgres/postgres.service';

/**
 * ProductEvent telemetry (R-21/R-22, C-07/C-08) — tagged releaseVersion + flag exposure.
 * Feedback (R-23) là bảng riêng; không gộp vào payload.
 * Chỉ persist allowlisted fields — PII/token redaction tại call site (QA-36/38).
 */
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
  workspaceId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  releaseVersion?: string;
  flagExposure?: Record<string, string>;
}

interface ProductEventDbRow extends QueryResultRow {
  id: string;
  workspace_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  release_version: string;
  flag_exposure: Record<string, string>;
  created_at: Date | string;
}

const COLUMNS = 'id, workspace_id, event_type, payload, release_version, flag_exposure, created_at';

@Injectable()
export class TelemetryService {
  constructor(private readonly db: PostgresService) {}

  async record(input: RecordEventInput): Promise<ProductEvent> {
    if (!input.workspaceId) throw new Error('workspaceId is required');
    if (!input.eventType) throw new Error('eventType is required');
    const releaseVersion = input.releaseVersion ?? process.env.npm_package_version ?? '0.1.0';
    const flagExposure: Record<string, string> = input.flagExposure ?? {};
    const payload: Record<string, unknown> = input.payload ?? {};
    const result = await this.db.query<ProductEventDbRow>(
      `INSERT INTO product_event (workspace_id, event_type, payload, release_version, flag_exposure)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb) RETURNING ${COLUMNS}`,
      [input.workspaceId, input.eventType, JSON.stringify(payload), releaseVersion, JSON.stringify(flagExposure)],
    );
    return toEvent(result.rows[0]);
  }

  async listByWorkspace(workspaceId: string): Promise<readonly ProductEvent[]> {
    const result = await this.db.query<ProductEventDbRow>(
      `SELECT ${COLUMNS} FROM product_event WHERE workspace_id = $1 ORDER BY created_at`,
      [workspaceId],
    );
    return result.rows.map(toEvent);
  }
}

function toEvent(r: ProductEventDbRow): ProductEvent {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    eventType: r.event_type,
    payload: r.payload,
    releaseVersion: r.release_version,
    flagExposure: r.flag_exposure,
    createdAt: new Date(r.created_at).toISOString(),
  };
}
