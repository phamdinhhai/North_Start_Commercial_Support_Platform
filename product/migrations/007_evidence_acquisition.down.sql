-- Reversible metadata rollback; never deletes or rewrites evidence rows.
ALTER TABLE commercial_envelope
  DROP COLUMN acquisition_source,
  DROP COLUMN acquisition_mode;
