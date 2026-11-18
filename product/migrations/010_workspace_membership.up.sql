-- 010_workspace_membership — internal principals + server-side workspace membership (ADR-006).
-- Workspace and base role are resolved from these tables, never from client input or token claims.
-- base_role is restricted to the EXISTING base roles; no new role or capability is introduced.
--
-- ADR-006 (R2-P-07): principal = internal `platform_user.id` (UUID). External IdP identities
-- (`issuer`, `subject`) are only LINKS to that user; adding/changing an IdP adds a link and never
-- moves ownership. Identities are created only by an admin grant (pre-provisioning), never by a
-- login, so an unknown (issuer, subject) is unauthenticated.
-- ADR-006 (R2-P-06): revoke is terminal, re-grant = new row, role change = revoke + grant in one
-- transaction, rows are never deleted, every grant/revoke is audited with the acting admin.

CREATE TABLE platform_user (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT NOT NULL DEFAULT 'active',
  CONSTRAINT platform_user_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE external_identity (
  issuer     TEXT NOT NULL,
  subject    TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES platform_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT external_identity_unique UNIQUE (issuer, subject),
  CONSTRAINT external_identity_issuer_check CHECK (length(issuer) BETWEEN 1 AND 2048 AND issuer !~ '[[:cntrl:]]'),
  CONSTRAINT external_identity_subject_check CHECK (length(subject) BETWEEN 1 AND 255 AND subject !~ '[[:cntrl:]]')
);

CREATE INDEX idx_external_identity_user ON external_identity (user_id);

CREATE TABLE memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  user_id      UUID NOT NULL REFERENCES platform_user(id),
  base_role    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  CONSTRAINT memberships_base_role_check CHECK (base_role IN ('admin', 'manager', 'sales', 'viewer')),
  CONSTRAINT memberships_status_check CHECK (
    (status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL)
  ),
  CONSTRAINT memberships_workspace_check CHECK (
    workspace_id ~ '^[a-zA-Z0-9:_./-]{1,128}$' AND workspace_id NOT LIKE 'demo:%'
  )
);

-- ADR-006: at most ONE active membership per (workspace, user); revoked rows are history.
CREATE UNIQUE INDEX memberships_active_unique ON memberships (workspace_id, user_id) WHERE status = 'active';
CREATE INDEX idx_memberships_active_user ON memberships (user_id) WHERE status = 'active';
CREATE INDEX idx_memberships_workspace ON memberships (workspace_id, created_at);

-- platform_user: id/created_at immutable; only status may change. Never deleted.
CREATE FUNCTION platform_user_guard_update() RETURNS trigger AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'platform_user id/created_at are immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_user_guard_update
  BEFORE UPDATE ON platform_user
  FOR EACH ROW EXECUTE FUNCTION platform_user_guard_update();

-- Shared refusal for DELETE/TRUNCATE (I-05: history is never erased) and for any UPDATE of an
-- identity link (a link is immutable: re-pointing it would silently transfer ownership).
CREATE FUNCTION principal_guard_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed (ADR-006, I-05)', TG_OP, TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_user_guard_delete
  BEFORE DELETE ON platform_user
  FOR EACH ROW EXECUTE FUNCTION principal_guard_immutable();
CREATE TRIGGER platform_user_guard_truncate
  BEFORE TRUNCATE ON platform_user
  FOR EACH STATEMENT EXECUTE FUNCTION principal_guard_immutable();
CREATE TRIGGER external_identity_guard_mutation
  BEFORE UPDATE OR DELETE ON external_identity
  FOR EACH ROW EXECUTE FUNCTION principal_guard_immutable();
CREATE TRIGGER external_identity_guard_truncate
  BEFORE TRUNCATE ON external_identity
  FOR EACH STATEMENT EXECUTE FUNCTION principal_guard_immutable();

-- Revocation is one-way (terminal) and identity/role columns are immutable: the only permitted
-- UPDATE is active -> revoked. A role change is revoke + a NEW row (history kept).
CREATE FUNCTION memberships_guard_update() RETURNS trigger AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id
     OR NEW.base_role <> OLD.base_role OR NEW.created_at <> OLD.created_at THEN
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

-- A-m4: rows are never deleted. DELETE/TRUNCATE would let "revoke" be bypassed by delete +
-- re-insert and would erase history (I-05).
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

-- Append-only grant/revoke history, written by the database itself so every path (admin API,
-- operator SQL, seed script) is recorded. Actor (ADR-006):
--   * through the app: the transaction-local setting `north.membership_actor` = the acting
--     admin's internal user id (must be a UUID of an existing platform_user, else the write fails);
--   * operator SQL/seed without the setting: `db:<session_user>` and actor_user_id NULL.
-- `transaction_id` groups the revoke + grant pair of a role change. Holds no token material.
CREATE TABLE membership_audit (
  id             BIGSERIAL PRIMARY KEY,
  membership_id  UUID NOT NULL REFERENCES memberships(id),
  operation      TEXT NOT NULL CHECK (operation IN ('grant', 'revoke')),
  workspace_id   TEXT NOT NULL,
  user_id        UUID NOT NULL REFERENCES platform_user(id),
  base_role      TEXT NOT NULL,
  actor          TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 256 AND actor !~ '[[:cntrl:]]'),
  actor_user_id  UUID REFERENCES platform_user(id),
  transaction_id TEXT NOT NULL DEFAULT pg_current_xact_id()::text,
  effective_at   TIMESTAMPTZ NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT membership_audit_actor_consistency CHECK (actor_user_id IS NULL OR actor = actor_user_id::text)
);

CREATE INDEX idx_membership_audit_membership ON membership_audit (membership_id, id);
CREATE INDEX idx_membership_audit_workspace ON membership_audit (workspace_id, id);

CREATE FUNCTION memberships_audit_write() RETURNS trigger AS $$
DECLARE
  setting  TEXT := NULLIF(current_setting('north.membership_actor', true), '');
  actor_id UUID := setting::uuid; -- non-UUID setting → invalid_text_representation (fail closed)
  who      TEXT := COALESCE(actor_id::text, 'db:' || session_user);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO membership_audit (membership_id, operation, workspace_id, user_id, base_role, actor, actor_user_id, effective_at)
    VALUES (NEW.id, 'grant', NEW.workspace_id, NEW.user_id, NEW.base_role, who, actor_id, NEW.created_at);
  ELSIF OLD.status = 'active' AND NEW.status = 'revoked' THEN
    INSERT INTO membership_audit (membership_id, operation, workspace_id, user_id, base_role, actor, actor_user_id, effective_at)
    VALUES (NEW.id, 'revoke', NEW.workspace_id, NEW.user_id, NEW.base_role, who, actor_id, NEW.revoked_at);
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
