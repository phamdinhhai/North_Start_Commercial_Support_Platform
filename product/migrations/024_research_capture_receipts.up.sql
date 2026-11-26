-- 024_research_capture_receipts — ADR-009 §3, R3 A-04 bounded encrypted research-capture storage.
-- Experimental synthetic research intake only; strictly outside canonical CommercialEvent truth.
-- Raw bytes are stored ONLY as AES-256-GCM ciphertext (`ciphertext bytea`), never plaintext/base64.
-- Trusted DB acceptance time fixes `expires_at <= accepted_at + 7 days`; `expires_at` is immutable.
-- Deletion of `research_capture_receipt` is permitted ONLY after expiry AND requires an atomic
-- `research_capture_audit` PURGED record in the same transaction.

CREATE TABLE research_capture_receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspace(id),
  connection_id text NOT NULL CHECK (length(connection_id) BETWEEN 1 AND 256 AND connection_id !~ '[[:cntrl:]]'),
  account_id text NOT NULL CHECK (length(account_id) BETWEEN 1 AND 256 AND account_id !~ '[[:cntrl:]]'),
  provider_surface text NOT NULL CHECK (provider_surface = 'pancake-pos'),
  receipt_id text NOT NULL CHECK (length(receipt_id) BETWEEN 1 AND 256 AND receipt_id !~ '[[:cntrl:]]'),
  received_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  retention_days integer NOT NULL CHECK (retention_days BETWEEN 1 AND 7),
  expires_at timestamptz NOT NULL,
  payload_digest jsonb NOT NULL,
  encryption_meta jsonb NOT NULL,
  ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) BETWEEN 1 AND 262144),
  evidence_type text NOT NULL CHECK (evidence_type = 'synthetic'),
  schema_status text NOT NULL CHECK (schema_status = 'uninterpreted'),
  UNIQUE (workspace_id, connection_id, account_id, provider_surface, receipt_id),
  CONSTRAINT research_capture_receipt_expiry_bound CHECK (
    expires_at > accepted_at
    AND expires_at <= accepted_at + interval '7 days'
    AND expires_at = accepted_at + (retention_days * interval '1 day')
  ),
  CONSTRAINT research_capture_receipt_digest_check CHECK (
    jsonb_typeof(payload_digest) = 'object'
    AND payload_digest ?& ARRAY['alg','kid','value']
    AND payload_digest - ARRAY['alg','kid','value'] = '{}'::jsonb
    AND payload_digest->>'alg' = 'HMAC-SHA256'
    AND payload_digest->>'kid' ~ '^[A-Za-z0-9._-]{1,64}$'
    AND payload_digest->>'value' ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT research_capture_receipt_encryption_check CHECK (
    jsonb_typeof(encryption_meta) = 'object'
    AND encryption_meta ?& ARRAY['alg','purpose','kid','nonceHex','tagHex']
    AND encryption_meta - ARRAY['alg','purpose','kid','nonceHex','tagHex'] = '{}'::jsonb
    AND encryption_meta->>'alg' = 'AES-256-GCM'
    AND encryption_meta->>'purpose' = 'research-capture-encryption-v1'
    AND encryption_meta->>'kid' ~ '^[A-Za-z0-9._-]{1,64}$'
    AND encryption_meta->>'nonceHex' ~ '^[a-f0-9]{24}$'
    AND encryption_meta->>'tagHex' ~ '^[a-f0-9]{32}$'
  )
);

CREATE INDEX idx_research_capture_receipt_expires ON research_capture_receipt (expires_at, id);
CREATE INDEX idx_research_capture_receipt_workspace ON research_capture_receipt (workspace_id, expires_at);

CREATE TABLE research_capture_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL REFERENCES workspace(id),
  receipt_row_id uuid NOT NULL,
  connection_id text NOT NULL,
  account_id text NOT NULL,
  provider_surface text NOT NULL CHECK (provider_surface = 'pancake-pos'),
  receipt_id text NOT NULL,
  operation text NOT NULL CHECK (
    operation IN ('STORED', 'DUPLICATE_OBSERVED', 'READ', 'EXPIRED_READ_DENIED', 'PURGED', 'UNKNOWN_KEY_OBSERVED')
  ),
  actor text NOT NULL CHECK (length(actor) BETWEEN 1 AND 256 AND actor !~ '[[:cntrl:]]'),
  digest_kid text NOT NULL CHECK (digest_kid ~ '^[A-Za-z0-9._-]{1,64}$'),
  encryption_kid text NOT NULL CHECK (encryption_kid ~ '^[A-Za-z0-9._-]{1,64}$'),
  accepted_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  transaction_id text NOT NULL DEFAULT pg_current_xact_id()::text
);

CREATE INDEX idx_research_capture_audit_workspace ON research_capture_audit (workspace_id, recorded_at, id);
CREATE INDEX idx_research_capture_audit_receipt ON research_capture_audit (receipt_row_id, operation);
CREATE UNIQUE INDEX uniq_research_capture_audit_purged ON research_capture_audit (receipt_row_id) WHERE operation = 'PURGED';

CREATE TABLE research_capture_failure (
  workspace_id text NOT NULL REFERENCES workspace(id),
  failure_key text NOT NULL CHECK (length(failure_key) BETWEEN 1 AND 512 AND failure_key !~ '[[:cntrl:]]'),
  receipt_key text CHECK (receipt_key IS NULL OR (length(receipt_key) BETWEEN 1 AND 512 AND receipt_key !~ '[[:cntrl:]]')),
  stage text NOT NULL CHECK (stage IN ('purge', 'read')),
  error_code text NOT NULL CHECK (
    error_code IN ('AUDIT_UNAVAILABLE', 'STORAGE_DELETE_FAILED', 'CIPHERTEXT_AUTH_FAILED', 'DIGEST_MISMATCH')
  ),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  first_failed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_failed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  PRIMARY KEY (workspace_id, failure_key)
);

CREATE INDEX idx_research_capture_failure_unresolved
  ON research_capture_failure (workspace_id, last_failed_at DESC)
  WHERE resolved_at IS NULL;

-- Immutability & Expiry-Only Audited Deletion Guard on `research_capture_receipt`.
CREATE FUNCTION research_capture_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'research_capture_receipt is immutable; expires_at and ciphertext cannot be updated'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'research_capture_receipt cannot be truncated; purge expired rows individually with audit'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.expires_at > transaction_timestamp() THEN
      RAISE EXCEPTION 'cannot delete unexpired research_capture_receipt before expires_at'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_research_capture_receipt_row
  BEFORE UPDATE OR DELETE ON research_capture_receipt
  FOR EACH ROW EXECUTE FUNCTION research_capture_receipt_guard();

CREATE TRIGGER guard_research_capture_receipt_truncate
  BEFORE TRUNCATE ON research_capture_receipt
  FOR EACH STATEMENT EXECUTE FUNCTION research_capture_receipt_guard();

-- Deferred constraint trigger: a deleted expired receipt MUST have a matching PURGED audit row
-- committed in the SAME transaction, otherwise the transaction fails closed and rolls back.
CREATE FUNCTION research_capture_require_purge_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM research_capture_audit a
     WHERE a.receipt_row_id = OLD.id
       AND a.workspace_id = OLD.workspace_id
       AND a.operation = 'PURGED'
       AND a.transaction_id = pg_current_xact_id()::text
  ) THEN
    RAISE EXCEPTION 'expired research_capture_receipt deletion requires atomic PURGED audit in same transaction'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER require_research_capture_purge_audit
  AFTER DELETE ON research_capture_receipt
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION research_capture_require_purge_audit();

-- Append-only guard for `research_capture_audit` (I-05).
CREATE FUNCTION research_capture_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'research_capture_audit is append-only (I-05)'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER guard_research_capture_audit_row
  BEFORE UPDATE OR DELETE ON research_capture_audit
  FOR EACH ROW EXECUTE FUNCTION research_capture_audit_append_only();

CREATE TRIGGER guard_research_capture_audit_truncate
  BEFORE TRUNCATE ON research_capture_audit
  FOR EACH STATEMENT EXECUTE FUNCTION research_capture_audit_append_only();
