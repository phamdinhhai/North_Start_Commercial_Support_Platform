-- Reverting an empty schema is testable; accepted immutable history must never be dropped.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM source_receipt) OR EXISTS (SELECT 1 FROM source_native_message) OR EXISTS (SELECT 1 FROM source_connection)
 THEN RAISE EXCEPTION 'source integration rollback requires empty history'; END IF;
END $$;
DROP TABLE source_receipt;
DROP TABLE source_native_message;
DROP TABLE source_connection;
DROP FUNCTION protect_source_history();
