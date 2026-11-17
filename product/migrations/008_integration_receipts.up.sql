-- Experimental research observations only; no foreign keys into commercial truth.
CREATE TABLE integration_enrollment (
 id UUID PRIMARY KEY, scope JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ, checkpoint BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE integration_receipt (
 id UUID PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES integration_enrollment(id),
 capture_id TEXT NOT NULL, sequence BIGINT NOT NULL CHECK(sequence > 0),
 fingerprint TEXT NOT NULL, metadata JSONB NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(enrollment_id,capture_id), UNIQUE(enrollment_id,sequence)
);
CREATE TABLE integration_audit (
 id BIGSERIAL PRIMARY KEY, enrollment_id UUID NOT NULL REFERENCES integration_enrollment(id),
 operation TEXT NOT NULL CHECK(operation IN ('enroll','revoke','receipt')), recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
