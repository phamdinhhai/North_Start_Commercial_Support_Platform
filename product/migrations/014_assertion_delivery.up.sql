CREATE TABLE assertion_outbox (
 workspace_id TEXT NOT NULL REFERENCES workspace(id), assertion_id UUID NOT NULL, proposal_id UUID NOT NULL,
 event_sequence INTEGER NOT NULL, envelope JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','LEASED','DELIVERED','FAILED')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0), next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_token UUID, lease_until TIMESTAMPTZ, last_error TEXT CHECK (last_error IN ('SINK_FAILED','LEASE_EXPIRED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), delivered_at TIMESTAMPTZ,
 PRIMARY KEY(workspace_id, assertion_id),
 FOREIGN KEY(proposal_id, event_sequence) REFERENCES governed_action_event(proposal_id, sequence),
 FOREIGN KEY(workspace_id, proposal_id) REFERENCES governed_action_proposal(workspace_id, id)
);
CREATE INDEX assertion_outbox_ready ON assertion_outbox(next_attempt_at) WHERE status IN ('PENDING','LEASED');
CREATE TABLE assertion_inbox (
 workspace_id TEXT NOT NULL REFERENCES workspace(id), assertion_id UUID NOT NULL, envelope JSONB NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id, assertion_id)
);
CREATE FUNCTION assertion_delivery_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'assertion delivery records are immutable'; END IF;
 IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR OLD.assertion_id IS DISTINCT FROM NEW.assertion_id
 OR OLD.proposal_id IS DISTINCT FROM NEW.proposal_id OR OLD.event_sequence IS DISTINCT FROM NEW.event_sequence
 OR OLD.envelope IS DISTINCT FROM NEW.envelope OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
 RAISE EXCEPTION 'assertion envelope is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assertion_outbox_immutable BEFORE UPDATE OR DELETE ON assertion_outbox FOR EACH ROW EXECUTE FUNCTION assertion_delivery_immutable();
CREATE TRIGGER assertion_inbox_immutable BEFORE UPDATE OR DELETE ON assertion_inbox FOR EACH ROW EXECUTE FUNCTION governed_action_event_append_only();

CREATE TRIGGER assertion_outbox_no_truncate BEFORE TRUNCATE ON assertion_outbox FOR EACH STATEMENT EXECUTE FUNCTION governed_action_event_append_only();
CREATE TRIGGER assertion_inbox_no_truncate BEFORE TRUNCATE ON assertion_inbox FOR EACH STATEMENT EXECUTE FUNCTION governed_action_event_append_only();
