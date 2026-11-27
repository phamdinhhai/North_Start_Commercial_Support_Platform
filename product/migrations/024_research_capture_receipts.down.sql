-- Refuse history loss. Only an empty/disposable schema can roll back 024_research_capture_receipts.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM research_capture_receipt)
     OR EXISTS (SELECT 1 FROM research_capture_audit)
     OR EXISTS (SELECT 1 FROM research_capture_failure) THEN
    RAISE EXCEPTION 'cannot roll back nonempty research capture history';
  END IF;
END $$;

DROP TABLE research_capture_failure;
DROP TABLE research_capture_audit;
DROP TABLE research_capture_receipt;
DROP FUNCTION research_capture_audit_append_only();
DROP FUNCTION research_capture_require_purge_audit();
DROP FUNCTION research_capture_receipt_guard();
