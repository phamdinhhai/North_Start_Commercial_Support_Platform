# Operational baseline: backup and data lifecycle

**Status:** safe runbook and dry-run helper only. This document does not resolve legal, retention, deletion, residency, or product open decisions.

## Scope and safety boundary

The application uses PostgreSQL for durable pilot data. A backup is an operational copy of raw and derived records; it is not a new commercial source of truth. Do not run backup, restore, retention, export, or deletion against a shared, production, customer, or otherwise non-caller-created database from this baseline.

`product/scripts/backup-verify.mjs` is intentionally conservative:

- Defaults to dry-run and requires an explicit `--execute` for `pg_dump`/`pg_restore`.
- Requires a PostgreSQL URL whose host is `localhost`, `127.0.0.1`, or `::1` and whose database name starts with `backup_verify_` or `disposable_`.
- Rejects system databases (`postgres`, `template0`, `template1`), remote hosts, implicit environment targets, and existing backup files unless `--force` is supplied.
- Execution additionally requires `BACKUP_VERIFY_ACK=I_CREATED_THIS_DISPOSABLE_DATABASE`.
- Never creates, drops, cleans, or overwrites a database. The caller must create and dispose of test databases using an independently reviewed process.
- Uses `pg_dump --format=custom --no-owner --no-privileges` and `pg_restore --list` for non-mutating archive inspection. `restore-verify` runs `pg_restore --exit-on-error --single-transaction` only into the explicitly named disposable target.

The helper is not a production backup scheduler, retention engine, encryption/key-management system, PITR solution, or legal compliance control.

## Dry-run and disposable PostgreSQL verification contract

From `product/`:

```sh
npm run backup:verify -- backup \
  --target postgres://127.0.0.1:55432/backup_verify_20261112 \
  --output /absolute/path/backup_verify_20261112.dump \
  --dry-run --json
```

The dry-run output is the planned command and normalized target identity; it does not connect to PostgreSQL. Before any execution, the caller must record evidence that:

1. The database was created by the caller solely for this verification.
2. The host, port, database, owner, and isolation boundary are known.
3. No customer or production data is present.
4. The output path is newly allocated and access-controlled.
5. The backup tool versions and environment are recorded.

Execute a logical backup only after that review:

```sh
BACKUP_VERIFY_ACK=I_CREATED_THIS_DISPOSABLE_DATABASE \
  npm run backup:verify -- backup \
  --target postgres://127.0.0.1:55432/backup_verify_20261112 \
  --output /absolute/path/backup_verify_20261112.dump \
  --execute --json
```

Inspect the archive without restoring it:

```sh
npm run backup:verify -- verify \
  --backup /absolute/path/backup_verify_20261112.dump \
  --execute --json
```

A restore verification requires a **different**, caller-created empty disposable database. The script does not create or clear it:

```sh
BACKUP_VERIFY_ACK=I_CREATED_THIS_DISPOSABLE_DATABASE \
  npm run backup:verify -- restore-verify \
  --backup /absolute/path/backup_verify_20261112.dump \
  --restore-target postgres://127.0.0.1:55432/backup_verify_restore_20261112 \
  --execute --json
```

After restore, use an independently authored read-only verification checklist (schema migration versions, row counts for selected fixture tables, representative audit/event records, and application health checks). Do not treat a successful `pg_restore` exit as proof of semantic equivalence. Dispose of both databases and the archive through a separately reviewed, non-destructive-to-production process; this helper does not delete them.

## Retention, export, and delete audit checklist

No retention or deletion policy is implemented by this change. Before any real-data operation, obtain the applicable product/legal decision and record:

- **Authority:** policy owner, approval ID, scope, jurisdiction, and effective date.
- **Dataset:** exact database/object/export scope, tenant/workspace/lead scope, synthetic-vs-real classification, and backup copies affected.
- **Purpose and basis:** operational purpose, legal basis, retention start event, expiry calculation, legal hold status, and exceptions.
- **Access:** requester, reviewer, least-privilege role, export recipient, encryption/key reference, transfer channel, and expiry of access.
- **Integrity:** immutable input/export digest, timestamp, tool/version, query or selection manifest, and whether raw payloads/PII/tokens were redacted.
- **Audit:** append-only audit event ID, actor, action (`retain`, `export`, `delete`, or `hold`), reason, target scope, result, and evidence location. Never overwrite prior audit records.
- **Verification:** independent reviewer confirms the intended records, backup/catalog impact, deletion propagation scope, and post-action checks. Unknown or conflicted scope must remain visible and block destructive action.
- **Recovery:** approved restore point, recovery owner, and test evidence; do not assume an export or deletion is reversible without a verified recovery path.

For exports, prefer the smallest field and record set needed, use parameterized queries, and redact credentials/tokens/PII in logs. For deletes, first produce a dry-run manifest and digest, obtain approval, apply only to the approved scope, then verify both primary and applicable derived/backup copies. The current codebase does not provide a safe generic delete/export command, so operators must not improvise one under this baseline.

## Evidence gaps and next gate

The repository currently lacks evidence for: a production-grade scheduler, encrypted off-site storage, key rotation, point-in-time recovery, restore-time RPO/RTO, cross-region handling, legal retention periods, customer export semantics, deletion propagation across backups, and independent semantic restore verification. These are explicit gaps, not claims of absence.

Before applying this workflow to real data, require an engineering review of backup storage/credentials and a product/legal decision for retention, export, deletion, hold, and recovery obligations. Until then, limit execution to caller-created disposable local databases and synthetic fixtures.
