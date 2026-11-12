-- 005_workspace_consistency down — remove enforcement without touching live rows.
-- Historical contradictions never left their original tables. Keep quarantine
-- snapshots for operator inspection across rollback/reapply; never restore or
-- overwrite rows from a potentially stale JSONB copy.

DROP TRIGGER IF EXISTS audit_record_lead_workspace_consistency ON audit_record;
DROP FUNCTION IF EXISTS enforce_audit_lead_workspace();

ALTER TABLE commercial_event DROP CONSTRAINT IF EXISTS commercial_event_lead_workspace_fk;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_lead_workspace_fk;
ALTER TABLE outcome DROP CONSTRAINT IF EXISTS outcome_lead_workspace_fk;
ALTER TABLE pilot_work_item DROP CONSTRAINT IF EXISTS pilot_work_item_lead_workspace_fk;
ALTER TABLE handoff DROP CONSTRAINT IF EXISTS handoff_lead_workspace_fk;
ALTER TABLE lead DROP CONSTRAINT IF EXISTS lead_id_workspace_key;

-- Deliberately retained: operators may resolve and remove quarantine rows explicitly.
