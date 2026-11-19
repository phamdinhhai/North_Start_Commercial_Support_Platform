-- Rollback drops all principals, identity links, membership rows AND the membership_audit history.
-- With AUTH_MODE=oidc this denies every OIDC caller (fail closed); export platform_user,
-- external_identity, memberships and membership_audit first if they must be retained
-- (engineering persistence/migration gate).
DROP TRIGGER IF EXISTS membership_audit_no_truncate ON membership_audit;
DROP TRIGGER IF EXISTS membership_audit_no_mutation ON membership_audit;
DROP FUNCTION IF EXISTS membership_audit_append_only();
DROP TRIGGER IF EXISTS memberships_audit_write ON memberships;
DROP FUNCTION IF EXISTS memberships_audit_write();
DROP TABLE IF EXISTS membership_audit;
DROP TRIGGER IF EXISTS memberships_guard_truncate ON memberships;
DROP TRIGGER IF EXISTS memberships_guard_delete ON memberships;
DROP FUNCTION IF EXISTS memberships_guard_delete();
DROP TRIGGER IF EXISTS memberships_check_identity ON memberships;
DROP FUNCTION IF EXISTS memberships_check_identity();
DROP TRIGGER IF EXISTS memberships_guard_update ON memberships;
DROP FUNCTION IF EXISTS memberships_guard_update();
DROP TABLE IF EXISTS memberships;
DROP TRIGGER IF EXISTS external_identity_guard_truncate ON external_identity;
DROP TRIGGER IF EXISTS external_identity_guard_mutation ON external_identity;
DROP TABLE IF EXISTS external_identity;
DROP TRIGGER IF EXISTS platform_user_guard_truncate ON platform_user;
DROP TRIGGER IF EXISTS platform_user_guard_delete ON platform_user;
DROP TRIGGER IF EXISTS platform_user_guard_update ON platform_user;
DROP FUNCTION IF EXISTS principal_guard_immutable();
DROP FUNCTION IF EXISTS platform_user_guard_update();
DROP TABLE IF EXISTS platform_user;
