-- 003_pilot_loop — PH3: durable pilot loop (lead owner, handoff recipient, work item, envelope link)
-- Bám canonical: I-07 stable Lead ID, I-09 owner/assignment, I-12 raw envelope immutable, I-05 append-audit.
-- Work item là validation construct cho Q3 (RFC-005 Draft) — không phải canonical Obligation entity.

-- lead: thêm owner server-derived (I-09) — "conversation assignment ≠ Sales ownership"
ALTER TABLE lead ADD COLUMN owner_user_id TEXT;

-- handoff: người nhận được chỉ định (Marketing A → Sales B). Recipient ≠ current owner.
ALTER TABLE handoff ADD COLUMN recipient_user_id TEXT;

-- envelope reference on lead — giữ liên kết raw evidence immutable (I-12), không nhân bản payload
ALTER TABLE lead ADD COLUMN source_envelope_id UUID REFERENCES commercial_envelope(id) ON DELETE SET NULL;

-- pilot_work_item — Q3 candidate axes: responsible party × origin × status × completion evidence
CREATE TABLE pilot_work_item (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  responsible_party TEXT NOT NULL CHECK (responsible_party IN ('internal','external')),
  origin TEXT NOT NULL CHECK (origin IN ('explicit-request','explicit-commitment','policy-sla','inferred')),
  status TEXT NOT NULL CHECK (status IN ('proposed','accepted','open','completed','cancelled','rescheduled','awaiting-external')),
  completion_evidence TEXT NOT NULL CHECK (completion_evidence IN ('observed','declared','inferred','absent','conflicted')),
  -- occurred_at: TEXT để giữ UNKNOWN_SENTINEL ('unknown') thay vì ép TIMESTAMPTZ (Q4: không backfill)
  occurred_at TEXT NOT NULL DEFAULT 'unknown',
  due_at TIMESTAMPTZ,
  evidence_ref TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  supersedes_work_id UUID REFERENCES pilot_work_item(id),
  actor TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_lead ON pilot_work_item(lead_id);
CREATE INDEX idx_work_workspace ON pilot_work_item(workspace_id);
CREATE INDEX idx_work_status ON pilot_work_item(status, due_at);
