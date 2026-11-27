DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM assertion_delivery_audit) OR EXISTS(SELECT 1 FROM assertion_outbox WHERE last_error NOT IN ('SINK_FAILED','LEASE_EXPIRED')) THEN
 RAISE EXCEPTION 'assertion operations rollback refuses evidence loss'; END IF;
END $$;
DROP TABLE assertion_delivery_audit;
ALTER TABLE assertion_outbox DROP CONSTRAINT assertion_outbox_last_error_check;
ALTER TABLE assertion_outbox ADD CONSTRAINT assertion_outbox_last_error_check CHECK(last_error IN ('SINK_FAILED','LEASE_EXPIRED'));
