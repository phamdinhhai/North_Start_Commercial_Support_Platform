-- Rollback drops all membership rows AND the membership_audit history. With AUTH_MODE=oidc this
-- denies every OIDC caller (fail closed); export memberships and membership_audit first if they
-- must be retained (engineering persistence/migration gate).
DROP TRIGGER IF EXISTS membership_audit_no_truncate ON membership_audit;
DROP TRIGGER IF EXISTS membership_audit_no_mutation ON membership_audit;
DROP FUNCTION IF EXISTS membership_audit_append_only();
DROP TRIGGER IF EXISTS memberships_audit_write ON memberships;
DROP FUNCTION IF EXISTS memberships_audit_write();
DROP TABLE IF EXISTS membership_audit;
DROP TRIGGER IF EXISTS memberships_guard_truncate ON memberships;
DROP TRIGGER IF EXISTS memberships_guard_delete ON memberships;
DROP FUNCTION IF EXISTS memberships_guard_delete();
DROP TRIGGER IF EXISTS memberships_guard_update ON memberships;
DROP FUNCTION IF EXISTS memberships_guard_update();
DROP TABLE IF EXISTS memberships;
