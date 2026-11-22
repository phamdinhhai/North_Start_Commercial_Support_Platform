-- Additive workflow history. Existing commercial evidence and states are untouched.
CREATE TABLE pilot_context_revision (
 id UUID PRIMARY KEY, lead_id UUID NOT NULL, workspace_id TEXT NOT NULL,
 text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 16000), actor TEXT NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL, reason TEXT NOT NULL,
 FOREIGN KEY (lead_id,workspace_id) REFERENCES lead(id,workspace_id)
);
CREATE INDEX pilot_context_revision_lead ON pilot_context_revision(lead_id,recorded_at,id);
CREATE TABLE pilot_closure_command (
 workspace_id TEXT NOT NULL, lead_id UUID NOT NULL, idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 actor TEXT NOT NULL, operation TEXT NOT NULL, digest JSONB NOT NULL, result JSONB NOT NULL,
 PRIMARY KEY(workspace_id,lead_id,idempotency_key),
 FOREIGN KEY (lead_id,workspace_id) REFERENCES lead(id,workspace_id)
);
CREATE FUNCTION reject_pilot_closure_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'pilot closure history is append-only'; END; $$;
CREATE TRIGGER pilot_context_immutable BEFORE UPDATE OR DELETE ON pilot_context_revision FOR EACH ROW EXECUTE FUNCTION reject_pilot_closure_rewrite();
CREATE TRIGGER pilot_command_immutable BEFORE UPDATE OR DELETE ON pilot_closure_command FOR EACH ROW EXECUTE FUNCTION reject_pilot_closure_rewrite();
