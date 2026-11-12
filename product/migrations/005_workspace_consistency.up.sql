-- 005_workspace_consistency — additive parent/child workspace hardening
--
-- Scope is intentionally limited to relationships that are explicit in the schema:
-- lead-owned commercial_event, handoff, pilot_work_item, outcome and feedback.
-- Existing contradictions stay in their original tables, visible to existing
-- readers. Quarantine stores an inspectable snapshot, not a replacement row.
-- NOT VALID composite FKs enforce future writes without validating legacy rows;
-- no workspace is inferred and no historical row is deleted.
--
-- audit_record is polymorphic (entity_type/entity_id) and therefore cannot safely
-- receive a universal FK without inventing semantics. This migration enforces the
-- explicit entity_type='lead' case only; other entity types remain unchanged.

CREATE TABLE IF NOT EXISTS workspace_consistency_quarantine (
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  row_data JSONB NOT NULL,
  workspace_id TEXT,
  lead_id UUID,
  quarantine_reason TEXT NOT NULL,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, source_id)
);

-- Snapshot historical contradictions without moving or deleting the live rows.
-- commercial_event is explicitly lead-owned; assertion_envelope has no lead
-- parent and is untouched.
INSERT INTO workspace_consistency_quarantine (
  source_table, source_id, row_data, workspace_id, lead_id, quarantine_reason
)
SELECT 'commercial_event', e.id, to_jsonb(e), e.workspace_id, e.lead_id,
       'commercial_event workspace differs from lead workspace (005_workspace_consistency)'
  FROM commercial_event e
  JOIN lead l ON l.id = e.lead_id
 WHERE e.workspace_id IS DISTINCT FROM l.workspace_id
ON CONFLICT (source_table, source_id) DO NOTHING;

INSERT INTO workspace_consistency_quarantine (
  source_table, source_id, row_data, workspace_id, lead_id, quarantine_reason
)
SELECT 'handoff', h.id, to_jsonb(h), h.workspace_id, h.lead_id,
       'handoff workspace differs from lead workspace (005_workspace_consistency)'
  FROM handoff h
  JOIN lead l ON l.id = h.lead_id
 WHERE h.workspace_id IS DISTINCT FROM l.workspace_id
ON CONFLICT (source_table, source_id) DO NOTHING;

INSERT INTO workspace_consistency_quarantine (
  source_table, source_id, row_data, workspace_id, lead_id, quarantine_reason
)
SELECT 'pilot_work_item', w.id, to_jsonb(w), w.workspace_id, w.lead_id,
       'pilot_work_item workspace differs from lead workspace (005_workspace_consistency)'
  FROM pilot_work_item w
  JOIN lead l ON l.id = w.lead_id
 WHERE w.workspace_id IS DISTINCT FROM l.workspace_id
ON CONFLICT (source_table, source_id) DO NOTHING;

INSERT INTO workspace_consistency_quarantine (
  source_table, source_id, row_data, workspace_id, lead_id, quarantine_reason
)
SELECT 'outcome', o.id, to_jsonb(o), o.workspace_id, o.lead_id,
       'outcome workspace differs from lead workspace (005_workspace_consistency)'
  FROM outcome o
  JOIN lead l ON l.id = o.lead_id
 WHERE o.workspace_id IS DISTINCT FROM l.workspace_id
ON CONFLICT (source_table, source_id) DO NOTHING;

-- A feedback row without a lead is not a lead-owned relationship and is left alone.
INSERT INTO workspace_consistency_quarantine (
  source_table, source_id, row_data, workspace_id, lead_id, quarantine_reason
)
SELECT 'feedback', f.id, to_jsonb(f), f.workspace_id, f.lead_id,
       'feedback workspace differs from lead workspace (005_workspace_consistency)'
  FROM feedback f
  LEFT JOIN lead l ON l.id = f.lead_id
 WHERE f.lead_id IS NOT NULL
   AND (l.id IS NULL OR f.workspace_id IS DISTINCT FROM l.workspace_id)
ON CONFLICT (source_table, source_id) DO NOTHING;

-- Only the explicit lead audit subject is enforceable without guessing the
-- meaning of arbitrary entity_type values. The CASE guard avoids casting an
-- untrusted entity_id to UUID while classifying malformed legacy rows.
INSERT INTO workspace_consistency_quarantine (
  source_table, source_id, row_data, workspace_id, lead_id, quarantine_reason
)
SELECT 'audit_record', a.id, to_jsonb(a), a.workspace_id,
       CASE WHEN a.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN a.entity_id::uuid ELSE NULL END,
       'lead audit workspace is malformed, missing, or differs from lead workspace (005_workspace_consistency)'
  FROM audit_record a
  LEFT JOIN lead l
    ON l.id = CASE WHEN a.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   THEN a.entity_id::uuid ELSE NULL END
 WHERE a.entity_type = 'lead'
   AND (l.id IS NULL OR a.workspace_id IS DISTINCT FROM l.workspace_id)
ON CONFLICT (source_table, source_id) DO NOTHING;

DO $$
DECLARE quarantined_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO quarantined_count FROM workspace_consistency_quarantine;
  IF quarantined_count > 0 THEN
    RAISE NOTICE '005_workspace_consistency: % contradictory row(s) copied to quarantine and retained live; no workspace was inferred.', quarantined_count;
  END IF;
END $$;

-- One stable parent key permits all typed children to bind lead_id and workspace_id atomically.
ALTER TABLE lead
  ADD CONSTRAINT lead_id_workspace_key UNIQUE (id, workspace_id);

ALTER TABLE commercial_event
  ADD CONSTRAINT commercial_event_lead_workspace_fk
  FOREIGN KEY (lead_id, workspace_id) REFERENCES lead (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE handoff
  ADD CONSTRAINT handoff_lead_workspace_fk
  FOREIGN KEY (lead_id, workspace_id) REFERENCES lead (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE pilot_work_item
  ADD CONSTRAINT pilot_work_item_lead_workspace_fk
  FOREIGN KEY (lead_id, workspace_id) REFERENCES lead (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE outcome
  ADD CONSTRAINT outcome_lead_workspace_fk
  FOREIGN KEY (lead_id, workspace_id) REFERENCES lead (id, workspace_id) ON DELETE CASCADE NOT VALID;

-- Keep the original nullable lead link: deleting a lead clears only feedback.lead_id,
-- while retaining feedback.workspace_id and the feedback row (PostgreSQL 16+).
ALTER TABLE feedback
  ADD CONSTRAINT feedback_lead_workspace_fk
  FOREIGN KEY (lead_id, workspace_id) REFERENCES lead (id, workspace_id)
  ON DELETE SET NULL (lead_id) NOT VALID;

CREATE OR REPLACE FUNCTION enforce_audit_lead_workspace()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE lead_workspace TEXT;
BEGIN
  IF NEW.entity_type = 'lead' THEN
    IF NEW.entity_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION '005_workspace_consistency: lead audit entity_id is not a UUID; refusing to guess';
    END IF;

    SELECT l.workspace_id INTO lead_workspace FROM lead l WHERE l.id = NEW.entity_id::uuid;
    IF NOT FOUND OR lead_workspace IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION '005_workspace_consistency: lead audit workspace must match lead workspace';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Do not retroactively reject unrelated edits to historical contradictory audits;
-- enforce new rows and changes to the lead reference/workspace identity.
CREATE TRIGGER audit_record_lead_workspace_consistency
BEFORE INSERT OR UPDATE OF entity_type, entity_id, workspace_id ON audit_record
FOR EACH ROW EXECUTE FUNCTION enforce_audit_lead_workspace();
