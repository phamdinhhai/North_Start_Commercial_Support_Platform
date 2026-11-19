ALTER TABLE assertion_outbox DROP CONSTRAINT assertion_outbox_last_error_check;
ALTER TABLE assertion_outbox ADD CONSTRAINT assertion_outbox_last_error_check CHECK(last_error IN ('SINK_FAILED','LEASE_EXPIRED','SINK_TIMEOUT','INVALID_ENVELOPE','ENVELOPE_CONFLICT','OPERATOR_STOP'));
CREATE TABLE assertion_delivery_audit (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id TEXT NOT NULL, assertion_id UUID NOT NULL,
 actor UUID NOT NULL REFERENCES platform_user(id), operation TEXT NOT NULL CHECK(operation IN ('replay','stop')),
 previous_status TEXT NOT NULL, previous_attempts INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,assertion_id) REFERENCES assertion_outbox(workspace_id,assertion_id)
);
CREATE TRIGGER assertion_delivery_audit_immutable BEFORE UPDATE OR DELETE ON assertion_delivery_audit FOR EACH ROW EXECUTE FUNCTION governed_action_event_append_only();
CREATE TRIGGER assertion_delivery_audit_no_truncate BEFORE TRUNCATE ON assertion_delivery_audit FOR EACH STATEMENT EXECUTE FUNCTION governed_action_event_append_only();
