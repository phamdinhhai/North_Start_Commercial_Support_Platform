-- Synthetic evidence intake only. Message identity is not customer/conversation/episode identity.
CREATE TABLE source_connection (
 id uuid PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspace(id),
 provider text NOT NULL CHECK(provider IN ('pancake','meta-page')),
 route text NOT NULL, page_id text NOT NULL, status text NOT NULL CHECK(status IN ('active','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 UNIQUE(workspace_id,id), CHECK(route=provider||'-synthetic')
);
CREATE TABLE source_native_message (
 workspace_id text NOT NULL, native_system text NOT NULL CHECK(native_system IN ('meta','pancake')),
 page_id text NOT NULL, message_id text NOT NULL,
 lead_id uuid NOT NULL, PRIMARY KEY(workspace_id,native_system,page_id,message_id),
 FOREIGN KEY(workspace_id,lead_id) REFERENCES lead(workspace_id,id)
);
CREATE TABLE source_receipt (
 id uuid PRIMARY KEY, workspace_id text NOT NULL, connection_id uuid NOT NULL, receipt_id text NOT NULL,
 native_system text, page_id text, conversation_id text, message_id text, event_id text, revision text,
 lead_id uuid, envelope_id uuid, observation jsonb NOT NULL, receipt_digest jsonb NOT NULL,
 disposition text NOT NULL CHECK(disposition IN ('stored','object_aligned','distinct_event','unknown')),
 quarantine_reason text CHECK(quarantine_reason='UNKNOWN_NATIVE_ID'), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,connection_id,receipt_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES source_connection(workspace_id,id),
 FOREIGN KEY(workspace_id,lead_id) REFERENCES lead(workspace_id,id),
 FOREIGN KEY(envelope_id) REFERENCES commercial_envelope(id),
 CHECK ((quarantine_reason IS NULL AND lead_id IS NOT NULL AND envelope_id IS NOT NULL) OR
        (quarantine_reason IS NOT NULL AND lead_id IS NULL AND envelope_id IS NULL))
);
CREATE INDEX source_receipt_lead ON source_receipt(workspace_id,lead_id,created_at,id);
CREATE INDEX source_receipt_native ON source_receipt(workspace_id,native_system,page_id,conversation_id,message_id);
CREATE FUNCTION protect_source_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'source evidence history is append-only'; END $$;
CREATE TRIGGER immutable_source_receipt BEFORE UPDATE OR DELETE ON source_receipt FOR EACH ROW EXECUTE FUNCTION protect_source_history();
CREATE TRIGGER immutable_source_native BEFORE UPDATE OR DELETE ON source_native_message FOR EACH ROW EXECUTE FUNCTION protect_source_history();
CREATE TRIGGER no_truncate_source_receipt BEFORE TRUNCATE ON source_receipt FOR EACH STATEMENT EXECUTE FUNCTION protect_source_history();
CREATE TRIGGER no_truncate_source_native BEFORE TRUNCATE ON source_native_message FOR EACH STATEMENT EXECUTE FUNCTION protect_source_history();
