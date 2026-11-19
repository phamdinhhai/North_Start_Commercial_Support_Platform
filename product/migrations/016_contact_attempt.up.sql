-- Claimed manual contact history. No canonical state transitions.
CREATE UNIQUE INDEX contact_envelope_workspace_key ON commercial_envelope(id,workspace_id);
CREATE TABLE pilot_contact_attempt (
 id UUID PRIMARY KEY, lead_id UUID NOT NULL, workspace_id TEXT NOT NULL,
 actor TEXT NOT NULL, recorded_at TIMESTAMPTZ NOT NULL,
 occurred_at TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('phone','message','email','other')),
 claimed_result TEXT NOT NULL CHECK(claimed_result IN ('reached','no-answer','left-message','unknown')),
 evidence_ref UUID, follow_up_implication TEXT NOT NULL CHECK(length(follow_up_implication) BETWEEN 1 AND 2000),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
 acquisition_mode TEXT NOT NULL CHECK(acquisition_mode='claimed'), assertion_status TEXT NOT NULL CHECK(assertion_status='claimed'),
 FOREIGN KEY(lead_id,workspace_id) REFERENCES lead(id,workspace_id),
 FOREIGN KEY(evidence_ref,workspace_id) REFERENCES commercial_envelope(id,workspace_id)
);
CREATE INDEX pilot_contact_attempt_lead ON pilot_contact_attempt(workspace_id,lead_id,id);
CREATE TRIGGER pilot_contact_attempt_immutable BEFORE UPDATE OR DELETE ON pilot_contact_attempt FOR EACH ROW EXECUTE FUNCTION reject_pilot_closure_rewrite();
