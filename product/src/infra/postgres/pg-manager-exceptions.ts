import type { SqlExecutor } from './postgres.service';
import type { ManagerExceptionsReader, ManagerExceptionsQuery, ManagerExceptionRow } from '../../ports/manager-exceptions';
/** One MVCC statement: current rows only, deduplicated booleans, server workspace on every relation. */
export class PgManagerExceptionsReader implements ManagerExceptionsReader {
 constructor(private readonly db: SqlExecutor) {}
 async scan(q: ManagerExceptionsQuery): Promise<readonly ManagerExceptionRow[]> {
  const result=await this.db.query<ManagerExceptionRow>(`
   WITH page AS (SELECT l.*, CASE WHEN e.is_synthetic=true THEN 'synthetic' WHEN e.is_synthetic=false THEN 'real' ELSE 'unknown' END AS classification
    FROM lead l LEFT JOIN commercial_envelope e ON e.id=l.source_envelope_id AND e.workspace_id=l.workspace_id
    WHERE l.workspace_id=$1 AND ($2='all' OR CASE WHEN e.is_synthetic=true THEN 'synthetic' WHEN e.is_synthetic=false THEN 'real' ELSE 'unknown' END=$2)
    AND ($3::uuid IS NULL OR l.id>$3::uuid) ORDER BY l.id LIMIT $4)
   SELECT l.id AS "leadId",l.display_name AS "displayName",l.version,l.classification,
    (l.owner_user_id IS NULL OR btrim(l.owner_user_id)='') AS "ownerMissing",
    CASE WHEN pending.value THEN to_char(h.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ELSE NULL END AS "awaitingSince",
    CASE WHEN NOT pending.value THEN NULL WHEN EXISTS(SELECT 1 FROM memberships m JOIN platform_user u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id::text=h.recipient_user_id AND m.status='active' AND u.status='active' AND m.base_role IN ('admin','manager','sales')) THEN 'active'
     WHEN EXISTS(SELECT 1 FROM memberships m JOIN platform_user u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.user_id::text=h.recipient_user_id AND (m.status='revoked' OR u.status='disabled' OR m.base_role='viewer')) THEN 'inactive' ELSE 'unknown' END AS "recipientState",
    EXISTS(SELECT 1 FROM pilot_work_item w WHERE w.lead_id=l.id AND w.workspace_id=$1 AND w.status IN ('proposed','accepted','open','awaiting-external') AND w.responsible_party='internal' AND w.due_at < statement_timestamp() AND NOT EXISTS(SELECT 1 FROM pilot_work_item s WHERE s.workspace_id=$1 AND s.lead_id=l.id AND s.supersedes_work_id=w.id)) AS overdue,
    EXISTS(SELECT 1 FROM outcome o WHERE o.lead_id=l.id AND o.workspace_id=$1 AND o.assertion_status='claimed' AND NOT EXISTS(SELECT 1 FROM outcome s WHERE s.workspace_id=$1 AND s.lead_id=l.id AND s.supersedes_outcome_id=o.id))
     AND EXISTS(SELECT 1 FROM pilot_work_item w WHERE w.lead_id=l.id AND w.workspace_id=$1 AND w.status IN ('proposed','accepted','open','awaiting-external') AND NOT EXISTS(SELECT 1 FROM pilot_work_item s WHERE s.workspace_id=$1 AND s.lead_id=l.id AND s.supersedes_work_id=w.id)) AS "claimedWithOpen",
    NOT EXISTS(SELECT 1 FROM commercial_envelope e WHERE e.id=l.source_envelope_id AND e.workspace_id=$1) AS "evidenceMissing",
    (lower(btrim(COALESCE(c.text,h.context,'unknown'))) IN ('','unknown','not_applicable','not_observed','not_requested','redacted')) AS "contextUnknown",
    (lower(btrim(COALESCE(l.conversation_source,'unknown'))) IN ('','unknown','not_applicable','not_observed','not_requested','redacted')) AS "sourceUnknown"
   FROM page l
   LEFT JOIN LATERAL(SELECT * FROM handoff WHERE lead_id=l.id AND workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1) h ON true
   LEFT JOIN LATERAL(SELECT text FROM pilot_context_revision WHERE lead_id=l.id AND workspace_id=$1 ORDER BY recorded_at DESC,id DESC LIMIT 1) c ON true
   CROSS JOIN LATERAL(SELECT h.id IS NOT NULL AND EXISTS(SELECT 1 FROM pilot_work_item w WHERE w.lead_id=l.id AND w.workspace_id=$1 AND w.status='proposed' AND w.actor=h.recipient_user_id AND NOT EXISTS(SELECT 1 FROM pilot_work_item s WHERE s.workspace_id=$1 AND s.lead_id=l.id AND s.supersedes_work_id=w.id)) AS value) pending
   ORDER BY l.id`,[q.workspaceId,q.classification,q.after??null,q.limit+1]);
  return result.rows;
 }
}


