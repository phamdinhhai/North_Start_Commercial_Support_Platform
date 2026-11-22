-- 011_governed_actions — Governed Commercial Action runtime (Propose → Preview → Authorize
-- → Execute → Verify → Audit). Synthetic/disabled executors only; no live provider writes.
-- I-03 AI draft-only · I-05 append-only audit · I-08 UNKNOWN outcome visible · I-09 workspace scope.
-- ADR-006 (PM-1): authority is decided by the application policy, not stored here.
-- ADR-005 (CE-2): AI proposals cite a draft CommercialEvent + evidence (R2-P-01); outcomes only
-- yield observed assertions (R2-P-02). OPEN: CE-1 — actions never move Commercial State.
-- ADR-007 (LG-1) / ADR-008 (MM-1): this migration creates storage only; it seeds NO capabilities.
-- The production capability catalog is empty (deny-all) until a capability is admitted.
-- History (A-M1): every event row carries the evidence needed to rebuild the projection.

CREATE TABLE governed_action_proposal (
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  request_key TEXT NOT NULL CHECK (length(request_key) BETWEEN 1 AND 128),
  capability_id TEXT NOT NULL CHECK (length(capability_id) BETWEEN 1 AND 128),
  risk_class TEXT NOT NULL CHECK (risk_class IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  target JSONB NOT NULL CHECK (jsonb_typeof(target) = 'object'),
  -- Authoritative canonical text (JSONB would re-order keys / normalize numbers).
  arguments_canonical TEXT NOT NULL,
  argument_digest TEXT NOT NULL CHECK (argument_digest ~ '^[0-9a-f]{64}$'),
  proposer_kind TEXT NOT NULL CHECK (proposer_kind IN ('human','ai','service')),
  proposer_id TEXT NOT NULL,
  rationale TEXT NOT NULL,
  constraints JSONB NOT NULL CHECK (jsonb_typeof(constraints) = 'object'),
  -- Stable Lead ID (I-07) when the action is lead-linked; access is lead-scoped (I-09).
  lead_id UUID,
  -- ADR-005 R2-P-01: cited CommercialEvent (pointer, no FK: evidence outlives lead housekeeping)
  -- and evidence pointers (opaque refs, never content). Frozen with the proposal.
  commercial_event_ref UUID,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (
    CASE WHEN jsonb_typeof(evidence_refs) = 'array' THEN jsonb_array_length(evidence_refs) <= 20 ELSE false END),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
  state TEXT NOT NULL CHECK (state IN ('PROPOSED','PREVIEWED','AUTHORIZED','EXECUTING','SUCCEEDED_VERIFIED',
    'FAILED_VERIFIED','UNKNOWN','REJECTED','EXPIRED','CANCELLED')),
  version INTEGER NOT NULL CHECK (version >= 1),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  -- Mutable lifecycle projection (preview / approval / execution / outcome). History lives in events.
  projection JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(projection) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL,
  -- AI proposals are drafts that must cite a CommercialEvent with ≥1 evidence pointer (ADR-005, I-03/I-04).
  CONSTRAINT governed_action_ai_requires_evidence CHECK (proposer_kind <> 'ai' OR (commercial_event_ref IS NOT NULL AND
    CASE WHEN jsonb_typeof(evidence_refs) = 'array' THEN jsonb_array_length(evidence_refs) >= 1 ELSE false END)),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, request_key),
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX idx_governed_action_proposal_state ON governed_action_proposal (workspace_id, state);

-- Frozen fields never change; version advances by exactly one per transition (CAS); no deletes.
CREATE FUNCTION governed_action_proposal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'governed_action_proposal is not deletable (I-05)' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.request_key <> OLD.request_key
     OR NEW.capability_id <> OLD.capability_id OR NEW.risk_class <> OLD.risk_class OR NEW.target <> OLD.target
     OR NEW.arguments_canonical <> OLD.arguments_canonical OR NEW.argument_digest <> OLD.argument_digest
     OR NEW.proposer_kind <> OLD.proposer_kind OR NEW.proposer_id <> OLD.proposer_id
     OR NEW.rationale <> OLD.rationale OR NEW.constraints <> OLD.constraints
     OR NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.idempotency_key <> OLD.idempotency_key
     OR NEW.commercial_event_ref IS DISTINCT FROM OLD.commercial_event_ref OR NEW.evidence_refs <> OLD.evidence_refs
     OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at THEN
    RAISE EXCEPTION 'governed_action_proposal frozen fields are immutable' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'governed_action_proposal version must advance by exactly one' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER governed_action_proposal_guard
  BEFORE UPDATE OR DELETE ON governed_action_proposal
  FOR EACH ROW EXECUTE FUNCTION governed_action_proposal_guard();

CREATE TABLE governed_action_event (
  workspace_id TEXT NOT NULL,
  proposal_id UUID NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  event_type TEXT NOT NULL CHECK (event_type IN ('PROPOSED','PREVIEWED','AUTHORIZED','REJECTED','CANCELLED',
    'EXPIRED','EXECUTION_STARTED','OUTCOME_RECORDED','VERIFICATION_RECORDED')),
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human','ai','service','system')),
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  recorded_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (proposal_id, sequence),
  FOREIGN KEY (workspace_id, proposal_id) REFERENCES governed_action_proposal (workspace_id, id)
);

-- Refused commands (I-05) — a separate append-only log that never bumps the proposal version,
-- so refused callers cannot make legitimate commands lose the CAS (A-m1).
CREATE TABLE governed_action_refusal (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  proposal_id UUID NOT NULL,
  proposal_version INTEGER NOT NULL CHECK (proposal_version >= 1),
  command TEXT NOT NULL CHECK (length(command) BETWEEN 1 AND 64),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human','ai','service')),
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(details) = 'array'),
  recorded_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (workspace_id, proposal_id) REFERENCES governed_action_proposal (workspace_id, id)
);
CREATE INDEX idx_governed_action_refusal_proposal ON governed_action_refusal (workspace_id, proposal_id, id);

-- Refused PROPOSE commands (ADR-005 R2-P-01, e.g. EVIDENCE_REQUIRED): no proposal row exists, so
-- they are keyed by workspace + request key. Append-only like the other audit tables (I-05).
CREATE TABLE governed_action_propose_refusal (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  request_key TEXT NOT NULL CHECK (length(request_key) BETWEEN 1 AND 128),
  capability_id TEXT NOT NULL CHECK (length(capability_id) BETWEEN 1 AND 128),
  lead_id UUID,
  commercial_event_ref UUID,
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 64),
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human','ai','service')),
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(details) = 'array'),
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_governed_action_propose_refusal_ws ON governed_action_propose_refusal (workspace_id, id);

-- Append-only: UPDATE, DELETE and TRUNCATE are refused at the database (I-05).
CREATE FUNCTION governed_action_event_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'governed_action_event is append-only (I-05)' USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER governed_action_event_no_mutation
  BEFORE UPDATE OR DELETE ON governed_action_event
  FOR EACH ROW EXECUTE FUNCTION governed_action_event_append_only();
CREATE TRIGGER governed_action_event_no_truncate
  BEFORE TRUNCATE ON governed_action_event
  FOR EACH STATEMENT EXECUTE FUNCTION governed_action_event_append_only();
CREATE TRIGGER governed_action_proposal_no_truncate
  BEFORE TRUNCATE ON governed_action_proposal
  FOR EACH STATEMENT EXECUTE FUNCTION governed_action_event_append_only();
CREATE TRIGGER governed_action_refusal_no_mutation
  BEFORE UPDATE OR DELETE ON governed_action_refusal
  FOR EACH ROW EXECUTE FUNCTION governed_action_event_append_only();
CREATE TRIGGER governed_action_refusal_no_truncate
  BEFORE TRUNCATE ON governed_action_refusal
  FOR EACH STATEMENT EXECUTE FUNCTION governed_action_event_append_only();
CREATE TRIGGER governed_action_propose_refusal_no_mutation
  BEFORE UPDATE OR DELETE ON governed_action_propose_refusal
  FOR EACH ROW EXECUTE FUNCTION governed_action_event_append_only();
CREATE TRIGGER governed_action_propose_refusal_no_truncate
  BEFORE TRUNCATE ON governed_action_propose_refusal
  FOR EACH STATEMENT EXECUTE FUNCTION governed_action_event_append_only();
