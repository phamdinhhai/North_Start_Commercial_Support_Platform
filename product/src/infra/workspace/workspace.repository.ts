import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { PostgresService } from '../postgres/postgres.service';

export interface WorkspaceRow {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

/**
 * Durable workspace repository (R-01, C-12).
 * Query methods always require server-derived workspace context; no body scope accepted.
 */
@Injectable()
export class WorkspaceRepository {
  constructor(private readonly db: PostgresService) {}

  async create(input: { id: string; name: string }): Promise<WorkspaceRow> {
    const result = await this.db.query<WorkspaceDbRow>(
      'INSERT INTO workspace (id, name) VALUES ($1, $2) RETURNING id, name, created_at',
      [input.id, input.name],
    );
    return toWorkspace(result.rows[0]);
  }

  async getById(workspaceId: string): Promise<WorkspaceRow | undefined> {
    const result = await this.db.query<WorkspaceDbRow>(
      'SELECT id, name, created_at FROM workspace WHERE id = $1',
      [workspaceId],
    );
    return result.rows[0] ? toWorkspace(result.rows[0]) : undefined;
  }

  async list(): Promise<readonly WorkspaceRow[]> {
    const result = await this.db.query<WorkspaceDbRow>('SELECT id, name, created_at FROM workspace ORDER BY created_at');
    return result.rows.map(toWorkspace);
  }
}

interface WorkspaceDbRow extends QueryResultRow {
  id: string;
  name: string;
  created_at: Date | string;
}

function toWorkspace(row: WorkspaceDbRow): WorkspaceRow {
  return { id: row.id, name: row.name, createdAt: new Date(row.created_at).toISOString() };
}
