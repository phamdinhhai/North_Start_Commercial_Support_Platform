-- Offline signed fixture delivery ledger. No provider token, raw duplicate payload or live permission.
CREATE TABLE fabricated_delivery (
 workspace_id text NOT NULL,connection_id uuid NOT NULL,delivery_id text NOT NULL CHECK(length(delivery_id) BETWEEN 1 AND 256),
 delivery_digest jsonb NOT NULL,accepted_count integer NOT NULL CHECK(accepted_count BETWEEN 0 AND 100),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,connection_id,delivery_id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES source_connection(workspace_id,id)
);
CREATE TABLE fabricated_delivery_attempt (
 id uuid PRIMARY KEY,workspace_id text NOT NULL,connection_id uuid NOT NULL,delivery_id text NOT NULL,
 duplicate boolean NOT NULL,credential_version integer NOT NULL CHECK(credential_version>0),recorded_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,connection_id,delivery_id) REFERENCES fabricated_delivery(workspace_id,connection_id,delivery_id)
);
CREATE INDEX fabricated_delivery_attempt_scope ON fabricated_delivery_attempt(workspace_id,connection_id,recorded_at,id);
CREATE TRIGGER immutable_fabricated_delivery BEFORE UPDATE OR DELETE ON fabricated_delivery FOR EACH ROW EXECUTE FUNCTION protect_source_history();
CREATE TRIGGER no_truncate_fabricated_delivery BEFORE TRUNCATE ON fabricated_delivery FOR EACH STATEMENT EXECUTE FUNCTION protect_source_history();
CREATE TRIGGER immutable_fabricated_delivery_attempt BEFORE UPDATE OR DELETE ON fabricated_delivery_attempt FOR EACH ROW EXECUTE FUNCTION protect_source_history();
CREATE TRIGGER no_truncate_fabricated_delivery_attempt BEFORE TRUNCATE ON fabricated_delivery_attempt FOR EACH STATEMENT EXECUTE FUNCTION protect_source_history();
