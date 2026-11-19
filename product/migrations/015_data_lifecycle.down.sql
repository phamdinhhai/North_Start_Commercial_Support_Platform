-- Refuse history loss. Only an empty/disposable schema can roll back this migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM data_lifecycle_policy) OR EXISTS (SELECT 1 FROM data_lifecycle_preview) THEN
    RAISE EXCEPTION 'cannot roll back nonempty lifecycle history';
  END IF;
END $$;
DROP TABLE data_lifecycle_preview;
DROP TABLE data_lifecycle_policy;
DROP FUNCTION protect_data_lifecycle_history();
