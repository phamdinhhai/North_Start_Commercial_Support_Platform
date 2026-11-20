-- ADR-007: local synthetic sync state; provider credentials and raw payload stay elsewhere.
CREATE TABLE sync_stream (
 id uuid PRIMARY KEY, workspace_id text NOT NULL, connection_id uuid NOT NULL,
 provider text NOT NULL CHECK(provider IN ('pancake','meta-page')), account_id text NOT NULL CHECK(length(account_id) BETWEEN 1 AND 256), capability text NOT NULL CHECK(capability='synthetic-messages'),
 mode text NOT NULL CHECK(mode='offline-synthetic'),
 status text NOT NULL CHECK(status IN ('active','paused','revoked','degraded','blocked')),
 cursor text CHECK(cursor IS NULL OR length(cursor) BETWEEN 1 AND 4096), completed boolean NOT NULL DEFAULT false,
 cursor_version integer NOT NULL DEFAULT 0 CHECK(cursor_version>=0), schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 last_attempted_at timestamptz, last_committed_at timestamptz,
 retry_count integer NOT NULL DEFAULT 0 CHECK(retry_count>=0), page_count integer NOT NULL DEFAULT 0 CHECK(page_count>=0), next_retry_at timestamptz,
 failure_code text CHECK(failure_code IN ('AUTH_REVOKED','RATE_LIMITED','TIMEOUT','SCHEMA_INVALID','GAP_DETECTED','DATABASE_UNAVAILABLE','RETRY_EXHAUSTED')),
 gap_status text NOT NULL DEFAULT 'UNKNOWN' CHECK(gap_status IN ('UNKNOWN','NONE','DETECTED')),
 lease_owner text, lease_token uuid, lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,connection_id,capability),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES source_connection(workspace_id,id),
 CHECK(completed=false OR cursor IS NULL),
 CHECK((lease_owner IS NULL AND lease_token IS NULL AND lease_until IS NULL) OR (lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX sync_stream_health ON sync_stream(workspace_id,status,next_retry_at,id);
CREATE TABLE sync_page_commit (
 id uuid PRIMARY KEY, workspace_id text NOT NULL, stream_id uuid NOT NULL,
 page_key text NOT NULL CHECK(length(page_key) BETWEEN 1 AND 256), version integer NOT NULL CHECK(version>0),
 from_cursor text, next_cursor text, completed boolean NOT NULL,
 page_digest jsonb NOT NULL, accepted_count integer NOT NULL CHECK(accepted_count BETWEEN 0 AND 100), duplicate_count integer NOT NULL CHECK(duplicate_count BETWEEN 0 AND 100),
 committed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,stream_id) REFERENCES sync_stream(workspace_id,id),
 UNIQUE(workspace_id,stream_id,page_key), UNIQUE(workspace_id,stream_id,version),CHECK(accepted_count+duplicate_count<=100)
);
CREATE TRIGGER immutable_sync_page_commit BEFORE UPDATE OR DELETE ON sync_page_commit FOR EACH ROW EXECUTE FUNCTION protect_source_history();
CREATE TRIGGER no_truncate_sync_page_commit BEFORE TRUNCATE ON sync_page_commit FOR EACH STATEMENT EXECUTE FUNCTION protect_source_history();

