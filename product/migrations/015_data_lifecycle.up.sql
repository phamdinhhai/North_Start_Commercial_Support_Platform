-- Planning only: no erasure rights, canonical mutations or default retention schedule.
CREATE TABLE data_lifecycle_policy (
  workspace_id text NOT NULL REFERENCES workspace(id),
  data_class text NOT NULL CHECK (data_class IN ('accepted_evidence','audit')),
  revision integer NOT NULL CHECK (revision > 0),
  retention_seconds integer NOT NULL CHECK (retention_seconds > 0),
  approval_ref varchar(160) NOT NULL CHECK (approval_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$'),
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,data_class,revision)
);
CREATE TABLE data_lifecycle_preview (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  data_class text NOT NULL,
  policy_revision integer NOT NULL,
  actor_id text NOT NULL,
  as_of timestamptz NOT NULL,
  eligible_count bigint NOT NULL CHECK (eligible_count BETWEEN 0 AND 9007199254740991),
  disposition text NOT NULL CHECK (disposition = 'BLOCKED_IMMUTABLE_HISTORY'),
  FOREIGN KEY (workspace_id,data_class,policy_revision) REFERENCES data_lifecycle_policy(workspace_id,data_class,revision)
);
CREATE FUNCTION protect_data_lifecycle_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'data lifecycle history is append-only'; END $$;
CREATE TRIGGER immutable_lifecycle_policy BEFORE UPDATE OR DELETE ON data_lifecycle_policy
  FOR EACH ROW EXECUTE FUNCTION protect_data_lifecycle_history();
CREATE TRIGGER immutable_lifecycle_preview BEFORE UPDATE OR DELETE ON data_lifecycle_preview
  FOR EACH ROW EXECUTE FUNCTION protect_data_lifecycle_history();
CREATE TRIGGER no_truncate_lifecycle_policy BEFORE TRUNCATE ON data_lifecycle_policy
  FOR EACH STATEMENT EXECUTE FUNCTION protect_data_lifecycle_history();
CREATE TRIGGER no_truncate_lifecycle_preview BEFORE TRUNCATE ON data_lifecycle_preview
  FOR EACH STATEMENT EXECUTE FUNCTION protect_data_lifecycle_history();
