-- Schema rollback drops these projection fields and loses their values.
-- Audit history is retained; re-up leaves NULL rather than fabricating claims.
ALTER TABLE pilot_work_item DROP COLUMN confirmed;
ALTER TABLE pilot_work_item DROP COLUMN declaration;
