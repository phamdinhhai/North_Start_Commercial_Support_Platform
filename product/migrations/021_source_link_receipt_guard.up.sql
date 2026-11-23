-- Additive defense: existing accepted history is never repaired or rewritten.
-- Serialize installation with source-link writes so preflight cannot race an insert.
LOCK TABLE source_episode_link IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (
  SELECT 1 FROM source_episode_link l
  LEFT JOIN source_receipt r ON r.workspace_id=l.workspace_id
   AND r.connection_id=l.connection_id AND r.receipt_id=l.receipt_id
  WHERE r.id IS NULL OR l.envelope_id IS DISTINCT FROM r.envelope_id
   OR l.origin_lead_id IS DISTINCT FROM r.lead_id
 ) THEN
  RAISE EXCEPTION 'source link receipt guard refuses inconsistent existing history';
 END IF;
END $$;
CREATE FUNCTION enforce_source_link_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM source_receipt r WHERE r.workspace_id=NEW.workspace_id
   AND r.connection_id=NEW.connection_id AND r.receipt_id=NEW.receipt_id
   AND r.envelope_id=NEW.envelope_id AND r.lead_id=NEW.origin_lead_id
 ) THEN
  RAISE EXCEPTION 'source link receipt evidence mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER source_link_receipt_guard BEFORE INSERT ON source_episode_link
 FOR EACH ROW EXECUTE FUNCTION enforce_source_link_receipt();
