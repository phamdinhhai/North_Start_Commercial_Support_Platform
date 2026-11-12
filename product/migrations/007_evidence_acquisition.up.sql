-- P1 evidence trust: retain explicit provenance for every envelope.
-- Existing rows are safely classified as imported/manual; raw evidence is untouched.
ALTER TABLE commercial_envelope
  ADD COLUMN acquisition_mode TEXT NOT NULL DEFAULT 'imported_record'
    CHECK (acquisition_mode IN ('automatic_observation', 'imported_record')),
  ADD COLUMN acquisition_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (acquisition_source IN ('system', 'manual'));
