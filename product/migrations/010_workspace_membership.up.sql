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

-- A-m4: rows are never deleted. Revocation is the only way out, so DELETE (and TRUNCATE) would
-- let "revoke" be bypassed by delete + re-insert and would erase history (I-05).
-- OPEN: PM-1 — re-grant after revoke and role change are NOT encoded here; the unique key plus
-- the one-way guard simply refuse them until the membership-lifecycle RFC decides (R2-P-06).
CREATE FUNCTION memberships_guard_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'memberships rows are not deletable; revoke instead (I-05)' USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memberships_guard_delete
  BEFORE DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION memberships_guard_delete();
CREATE TRIGGER memberships_guard_truncate
  BEFORE TRUNCATE ON memberships
  FOR EACH STATEMENT EXECUTE FUNCTION memberships_guard_delete();

-- A-m4: append-only grant/revoke history, written by the database itself so every path
-- (store, operator SQL, seed script) is recorded. `actor` = the transaction-local setting
-- `north.membership_actor` when an operator sets it, else `db:<session_user>` (honest default:
-- no HTTP grant API exists, PM-1). Holds no token material.
CREATE TABLE membership_audit (
  id            BIGSERIAL PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES memberships(id),
  operation     TEXT NOT NULL CHECK (operation IN ('grant', 'revoke')),
  workspace_id  TEXT NOT NULL,
  issuer        TEXT NOT NULL,
  subject       TEXT NOT NULL,
  base_role     TEXT NOT NULL,
  actor         TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 256 AND actor !~ '[[:cntrl:]]'),
  effective_at  TIMESTAMPTZ NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_membership_audit_membership ON membership_audit (membership_id, id);

CREATE FUNCTION memberships_audit_write() RETURNS trigger AS $$
DECLARE
  who TEXT := COALESCE(NULLIF(current_setting('north.membership_actor', true), ''), 'db:' || session_user);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO membership_audit (membership_id, operation, workspace_id, issuer, subject, base_role, actor, effective_at)
    VALUES (NEW.id, 'grant', NEW.workspace_id, NEW.issuer, NEW.subject, NEW.base_role, who, NEW.created_at);
  ELSIF OLD.status = 'active' AND NEW.status = 'revoked' THEN
    INSERT INTO membership_audit (membership_id, operation, workspace_id, issuer, subject, base_role, actor, effective_at)
    VALUES (NEW.id, 'revoke', NEW.workspace_id, NEW.issuer, NEW.subject, NEW.base_role, who, NEW.revoked_at);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memberships_audit_write
  AFTER INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION memberships_audit_write();

CREATE FUNCTION membership_audit_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'membership_audit is append-only (I-05)' USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER membership_audit_no_mutation
  BEFORE UPDATE OR DELETE ON membership_audit
  FOR EACH ROW EXECUTE FUNCTION membership_audit_append_only();
CREATE TRIGGER membership_audit_no_truncate
  BEFORE TRUNCATE ON membership_audit
  FOR EACH STATEMENT EXECUTE FUNCTION membership_audit_append_only();
