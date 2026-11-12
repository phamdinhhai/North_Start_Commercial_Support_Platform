-- R-06: one durable result per *pilot ingest command*, not a restriction on
-- how many Leads may cite a raw envelope as evidence in other workflows.
-- The deferred FK lets the command reserve its envelope before the Lead insert
-- in the same transaction. No committed command can point to a missing Lead.
CREATE TABLE pilot_ingest_command (
  envelope_id UUID PRIMARY KEY REFERENCES commercial_envelope(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL UNIQUE REFERENCES lead(id) DEFERRABLE INITIALLY DEFERRED
);

-- Backfill only unambiguous legacy intake: one Lead references this envelope.
-- Multiple historical Leads sharing evidence cannot establish which was the
-- original command result; they remain unlinked rather than guessed/merged.
INSERT INTO pilot_ingest_command (envelope_id, lead_id)
SELECT source_envelope_id, (array_agg(id))[1]
  FROM lead
 WHERE source_envelope_id IS NOT NULL
 GROUP BY source_envelope_id
HAVING COUNT(*) = 1;
