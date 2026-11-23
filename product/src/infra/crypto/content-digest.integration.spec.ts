import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PostgresService } from '../postgres/postgres.service';
import { createEnvelope } from '../../domain/envelope/envelope';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('R4 additive keyed digest database contract', () => {
  let db: PostgresService;
  const workspace = `digest-${randomUUID()}`;
  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)', [workspace]);
  });
  afterAll(async () => { await db?.onModuleDestroy(); });
  const insert = async (hash: string, metadata: unknown) => db.query(
    `INSERT INTO commercial_envelope(id,workspace_id,connection,external_record_id,external_event_type,
      source_captured_at,raw_payload,raw_payload_hash,raw_payload_digest)
      VALUES($1::uuid,$2,'security',$1::text,'message',now(),'{}'::jsonb,$3,$4::jsonb)`,
    [randomUUID(), workspace, hash, metadata === undefined ? null : JSON.stringify(metadata)],
  );
  it('accepts untouched legacy rows and valid new metadata; rejects malformed metadata without rewriting evidence', async () => {
    const legacy = 'a'.repeat(64); await insert(legacy, undefined);
    const env = createEnvelope({ workspaceId: workspace, connection: 'security', externalRecordId: 'new', externalEventType: 'message', sourceCapturedAt: new Date().toISOString(), rawPayload: {} });
    await insert(env.rawPayloadHash, env.rawPayloadDigest);
    for (const invalid of [{}, { ...env.rawPayloadDigest, kid: null }, { ...env.rawPayloadDigest, value: 'b'.repeat(64) }, { ...env.rawPayloadDigest, algorithm_version: 'sha256' }, { ...env.rawPayloadDigest, extra: true }]) {
      await expect(insert(env.rawPayloadHash, invalid)).rejects.toThrow('commercial_envelope_digest_metadata');
    }
    const rows = await db.query('SELECT raw_payload_hash,raw_payload_digest FROM commercial_envelope WHERE workspace_id=$1', [workspace]);
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.some((row) => row.raw_payload_hash === legacy && row.raw_payload_digest === null)).toBe(true);
  });
  it('refuses rollback while keyed evidence exists', async () => {
    const down = readFileSync(join(process.cwd(), 'migrations/012_content_digest.down.sql'), 'utf8');
    await expect(db.withTransaction(async (tx) => { await tx.query(down); })).rejects.toThrow('keyed_digest_rows_prevent_rollback');
    expect((await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='commercial_envelope' AND column_name='raw_payload_digest'")).rowCount).toBe(1);
  });
});
