-- Explicit synthetic receipt-to-episode context history; does not merge identities.
CREATE TABLE source_episode_link (
 id uuid PRIMARY KEY, workspace_id text NOT NULL, connection_id uuid NOT NULL, receipt_id text NOT NULL,
 lead_id uuid NOT NULL, origin_lead_id uuid NOT NULL, effective_lead_id uuid,
 envelope_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 action text NOT NULL CHECK(action IN ('link','unlink','reject')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000), actor_id text NOT NULL,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128), command_digest jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,connection_id,receipt_id,version),
 UNIQUE(workspace_id,connection_id,receipt_id,idempotency_key),
 FOREIGN KEY(workspace_id,connection_id,receipt_id) REFERENCES source_receipt(workspace_id,connection_id,receipt_id),
 FOREIGN KEY(workspace_id,lead_id) REFERENCES lead(workspace_id,id),
 FOREIGN KEY(workspace_id,origin_lead_id) REFERENCES lead(workspace_id,id),
 FOREIGN KEY(workspace_id,effective_lead_id) REFERENCES lead(workspace_id,id),
 FOREIGN KEY(envelope_id) REFERENCES commercial_envelope(id),
 CHECK((action='link' AND effective_lead_id IS NOT NULL AND effective_lead_id=lead_id) OR (action IN ('unlink','reject') AND effective_lead_id IS NULL))
);
CREATE INDEX source_episode_link_lead ON source_episode_link(workspace_id,lead_id,recorded_at,id);
CREATE INDEX source_episode_link_effective ON source_episode_link(workspace_id,effective_lead_id);
CREATE TRIGGER immutable_source_episode_link BEFORE UPDATE OR DELETE ON source_episode_link FOR EACH ROW EXECUTE FUNCTION protect_source_history();
CREATE TRIGGER no_truncate_source_episode_link BEFORE TRUNCATE ON source_episode_link FOR EACH STATEMENT EXECUTE FUNCTION protect_source_history();
