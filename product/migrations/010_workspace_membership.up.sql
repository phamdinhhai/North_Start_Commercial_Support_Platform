-- 010_workspace_membership — experimental server-side workspace membership (AUTH_MODE=oidc).
-- Workspace and base role are resolved from this table, never from client input or token claims.
-- base_role is restricted to the EXISTING base roles; no new role or capability is introduced.
-- OPEN: PM-1 — membership lifecycle/approval, capability matrix and revocation SLA are undecided.
CREATE TABLE memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  issuer       TEXT NOT NULL,
  subject      TEXT NOT NULL,
  base_role    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  CONSTRAINT memberships_identity_unique UNIQUE (issuer, subject, workspace_id),
  CONSTRAINT memberships_base_role_check CHECK (base_role IN ('admin', 'manager', 'sales', 'viewer')),
  CONSTRAINT memberships_status_check CHECK (
    (status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT memberships_issuer_check CHECK (length(issuer) BETWEEN 1 AND 2048 AND issuer !~ '[[:cntrl:]]'),
  CONSTRAINT memberships_subject_check CHECK (length(subject) BETWEEN 1 AND 255 AND subject !~ '[[:cntrl:]]'),
  CONSTRAINT memberships_workspace_check CHECK (
    workspace_id ~ '^[a-zA-Z0-9:_./-]{1,128}$' AND workspace_id NOT LIKE 'demo:%'
  )
);

CREATE INDEX idx_memberships_active_principal ON memberships (issuer, subject) WHERE status = 'active';

-- Revocation is one-way and identity columns are immutable (no overwrite of history, I-05 spirit):
-- the only permitted UPDATE is active -> revoked.
CREATE FUNCTION memberships_guard_update() RETURNS trigger AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.issuer <> OLD.issuer
     OR NEW.subject <> OLD.subject OR NEW.base_role <> OLD.base_role OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'memberships identity/role columns are immutable' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (OLD.status = 'active' AND NEW.status = 'revoked') THEN
    RAISE EXCEPTION 'memberships only allow active -> revoked transitions' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memberships_guard_update
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION memberships_guard_update();
