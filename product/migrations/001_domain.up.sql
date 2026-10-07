-- 001_domain — PH3 T3-02: workspace, customer, lead, handoff, CE/assertion, outcome, audit/outbox, envelope
-- I-01 Customer != Lead (riêng bảng) · I-07 stable ID · I-08 UNKNOWN · I-12 raw preserve
-- Spec draft §7 data contract · QA-24 supersedes · QA-36 truth states

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- workspace
CREATE TABLE workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- customer (I-01 riêng, không lead)
CREATE TABLE customer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_workspace ON customer(workspace_id);

-- lead (I-07 stable, I-02 source/lineage/attribution tách, I-08 UNKNOWN)
CREATE TABLE lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
  conversation_source TEXT,
  acquisition_lineage TEXT,
  attribution TEXT NOT NULL DEFAULT 'unknown'
    CHECK (attribution IN ('unknown','not_applicable','not_observed','not_requested','redacted')),
  status TEXT NOT NULL DEFAULT 'New'
    CHECK (status IN ('New','Accepted','Contacting','Follow-up','Won','Lost','Unknown')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1
);
CREATE INDEX idx_lead_workspace ON lead(workspace_id);
CREATE INDEX idx_lead_customer ON lead(customer_id);
CREATE INDEX idx_lead_status ON lead(status);

-- handoff (context + evidence refs + proposed action)
CREATE TABLE handoff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  context TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_next_action JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_handoff_lead ON handoff(lead_id);
CREATE INDEX idx_handoff_workspace ON handoff(workspace_id);

-- commercial_event (inferred-only interim CE-2, I-04 provenance, policy pending I-03)
CREATE TABLE commercial_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  inferred_meaning TEXT NOT NULL,
  confidence JSONB NOT NULL,
  evidence_ref TEXT,
  evidence_reason TEXT,
  source_actor TEXT NOT NULL,
  created_by TEXT NOT NULL,
  policy_check TEXT NOT NULL DEFAULT 'pending' CHECK (policy_check IN ('pending','approved','rejected')),
  provenance JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (evidence_ref IS NOT NULL OR evidence_reason IS NOT NULL)
);

-- assertion_envelope (non-inferred: observed/claimed/imported/user_confirmed — I-10 boundary)
CREATE TABLE assertion_envelope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  value TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL CHECK (acquisition_mode IN ('observed','claimed','imported','user_confirmed')),
  assertion_status TEXT NOT NULL DEFAULT 'claimed',
  source_actor TEXT NOT NULL,
  created_by TEXT NOT NULL,
  supersedes_assertion_id UUID REFERENCES assertion_envelope(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- outcome (Won/Lost/Unknown, supersedes — QA-24, I-05 append)
CREATE TABLE outcome (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  value TEXT NOT NULL CHECK (value IN ('Won','Lost','Unknown')),
  acquisition_mode TEXT NOT NULL DEFAULT 'user_confirmed',
  assertion_status TEXT NOT NULL DEFAULT 'claimed',
  actor TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  supersedes_outcome_id UUID REFERENCES outcome(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outcome_lead ON outcome(lead_id);

-- audit / outbox (I-05 append-only, atomic with mutation QA-35)
CREATE TABLE audit_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  event_type TEXT,
  supersedes_record_id TEXT
);
CREATE INDEX idx_audit_entity ON audit_record(entity_type, entity_id);
CREATE INDEX idx_audit_workspace ON audit_record(workspace_id);

-- commercial envelope (I-12 raw preserve, R-05/R-06) — connection + external IDs idempotent
CREATE TABLE commercial_envelope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version INT NOT NULL DEFAULT 1,
  connection TEXT NOT NULL,
  external_record_id TEXT NOT NULL,
  external_event_type TEXT NOT NULL,
  source_captured_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB NOT NULL,
  raw_payload_hash TEXT NOT NULL,
  mapping_status TEXT NOT NULL DEFAULT 'pending' CHECK (mapping_status IN ('pending','mapped','error')),
  mapping_error TEXT,
  canonical_projection JSONB,
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (connection, external_record_id)
);
