-- Never discard metadata while a keyed evidence/proposal still depends on it.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commercial_envelope WHERE raw_payload_digest IS NOT NULL)
    OR EXISTS (SELECT 1 FROM governed_action_proposal WHERE argument_digest LIKE 'hmac-sha256-v1:%')
  THEN RAISE EXCEPTION 'keyed_digest_rows_prevent_rollback'; END IF;
END $$;
ALTER TABLE governed_action_proposal DROP CONSTRAINT governed_action_proposal_argument_digest_check;
ALTER TABLE governed_action_proposal ADD CONSTRAINT governed_action_proposal_argument_digest_check CHECK (argument_digest ~ '^[0-9a-f]{64}$');
ALTER TABLE commercial_envelope DROP CONSTRAINT commercial_envelope_digest_metadata;
ALTER TABLE commercial_envelope DROP COLUMN raw_payload_digest;
