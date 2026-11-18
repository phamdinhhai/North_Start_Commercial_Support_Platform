-- Rollback drops all membership rows. With AUTH_MODE=oidc this denies every OIDC caller
-- (fail closed); export memberships first if they must be retained.
DROP TRIGGER IF EXISTS memberships_guard_update ON memberships;
DROP FUNCTION IF EXISTS memberships_guard_update();
DROP TABLE IF EXISTS memberships;
