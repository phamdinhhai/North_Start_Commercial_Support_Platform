import type {
  ConnectorHealthReader, EnrollmentHealthPage, EnrollmentHealthRow,
} from '../../ports/connector-health';

/** Test/DB-less fake with the same workspace-filter contract as the PostgreSQL adapter. */
export class InMemoryConnectorHealthReader implements ConnectorHealthReader {
  constructor(
    private readonly rows: EnrollmentHealthRow[] = [],
    private readonly now: () => Date = () => new Date(),
  ) {}

  add(row: EnrollmentHealthRow): void {
    this.rows.push(row);
  }

  async listByWorkspace(workspaceId: string, limit: number): Promise<EnrollmentHealthPage> {
    const matching = this.rows
      .filter((row) => row.workspaceId === workspaceId)
      .sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime() || a.enrollmentId.localeCompare(b.enrollmentId));
    return { observedAt: this.now(), rows: matching.slice(0, limit), truncated: matching.length > limit };
  }
}
