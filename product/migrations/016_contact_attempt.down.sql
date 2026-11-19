-- Claim history cannot be removed by a routine schema downgrade.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pilot_contact_attempt) THEN
  RAISE EXCEPTION 'cannot roll back nonempty contact history';
 END IF;
END $$;
DROP TABLE pilot_contact_attempt;
DROP INDEX contact_envelope_workspace_key;
