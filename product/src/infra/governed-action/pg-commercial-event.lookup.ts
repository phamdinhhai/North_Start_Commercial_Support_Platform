import type { CommercialEventFacts } from '../../domain/governed-action/governed-action.types';
import type { CommercialEventLookup } from '../../ports/governed-action';
import type { SqlExecutor } from '../postgres/postgres.service';

interface CommercialEventRow {
  id: string;
  workspace_id: string;
  lead_id: string;
  evidence_ref: string | null;
  policy_check: string;
  provenance: { acquisitionMode?: unknown; assertionStatus?: unknown; rawEvidencePointer?: unknown } | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ADR-005 R2-P-01 — read-only, workspace-scoped lookup of a cited CommercialEvent in the
 * `commercial_event` table (migration 001). The table holds inferred CEs only; status comes from
 * the provenance envelope, and a missing provenance is reported as `unknown` (I-08), which an AI
 * proposal can never cite. Never writes.
 */
export class PgCommercialEventLookup implements CommercialEventLookup {
  constructor(private readonly db: SqlExecutor) {}

  async find(workspaceId: string, commercialEventId: string): Promise<CommercialEventFacts | undefined> {
    if (typeof commercialEventId !== 'string' || !UUID.test(commercialEventId)) return undefined;
    const result = await this.db.query<CommercialEventRow>(
      `SELECT id, workspace_id, lead_id, evidence_ref, policy_check, provenance
         FROM commercial_event WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, commercialEventId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const prov = row.provenance && typeof row.provenance === 'object' ? row.provenance : null;
    const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.length > 0 ? v : fallback);
    const pointers = [row.evidence_ref, prov?.rawEvidencePointer]
      .filter((p, i, all): p is string => typeof p === 'string' && p.length > 0 && all.indexOf(p) === i);
    return Object.freeze({
      id: row.id, workspaceId: row.workspace_id, leadId: row.lead_id,
      acquisitionMode: text(prov?.acquisitionMode, 'inferred'),
      assertionStatus: text(prov?.assertionStatus, 'unknown'),
      policyCheck: row.policy_check,
      evidencePointers: Object.freeze(pointers),
    });
  }
}
