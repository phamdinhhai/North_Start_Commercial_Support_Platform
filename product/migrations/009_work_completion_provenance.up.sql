-- Preserve completion provenance in the current projection (I-05/I-12).
-- Legacy NULL means unknown; do not infer declarations from reasons or audit.
ALTER TABLE pilot_work_item ADD COLUMN declaration TEXT;
ALTER TABLE pilot_work_item ADD COLUMN confirmed BOOLEAN;
