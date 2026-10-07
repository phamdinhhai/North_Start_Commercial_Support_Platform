-- 002_telemetry_feedback — PH3 T3-06/T3-07
-- C-08 product telemetry (R-21/R-22) + feedback (R-23); tách biệt telemetry vs feedback

CREATE TABLE IF NOT EXISTS product_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  release_version TEXT NOT NULL,
  flag_exposure JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_event_workspace ON product_event(workspace_id);
CREATE INDEX IF NOT EXISTS idx_product_event_type ON product_event(event_type);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES lead(id) ON DELETE SET NULL,
  actor TEXT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  body TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_workspace ON feedback(workspace_id);
