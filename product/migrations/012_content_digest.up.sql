-- ADR-009: additive metadata only. Historical evidence and digest bytes are never rewritten.
ALTER TABLE commercial_envelope ADD COLUMN raw_payload_digest JSONB;
ALTER TABLE commercial_envelope ADD CONSTRAINT commercial_envelope_digest_metadata CHECK (
  raw_payload_digest IS NULL OR (
    jsonb_typeof(raw_payload_digest) = 'object'
    AND raw_payload_digest ?& ARRAY['algorithm_version','kid','value']
    AND raw_payload_digest - ARRAY['algorithm_version','kid','value'] = '{}'::jsonb
    AND raw_payload_digest->>'algorithm_version' = 'hmac-sha256-v1'
    AND raw_payload_digest->>'kid' ~ '^[A-Za-z0-9._-]{1,64}$'
    AND raw_payload_digest->>'value' ~ '^[a-f0-9]{64}$'
    AND raw_payload_digest->>'value' = raw_payload_hash
    AND jsonb_typeof(raw_payload_digest->'algorithm_version') = 'string'
    AND jsonb_typeof(raw_payload_digest->'kid') = 'string'
    AND jsonb_typeof(raw_payload_digest->'value') = 'string'
  ) IS TRUE
);

ALTER TABLE governed_action_proposal DROP CONSTRAINT governed_action_proposal_argument_digest_check;
ALTER TABLE governed_action_proposal ADD CONSTRAINT governed_action_proposal_argument_digest_check
  CHECK (argument_digest ~ '^[0-9a-f]{64}$' OR argument_digest ~ '^hmac-sha256-v1:[A-Za-z0-9._-]{1,64}:[a-f0-9]{64}$');
