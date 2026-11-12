import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { Migrator, loadMigrations } from './migrator';
import { PostgresService } from './postgres.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

/**
 * Migration 004 data-safety proof (P1-1 review follow-up).
 *
 * Runs against a THROWAWAY database created on the same PostgreSQL instance, so it can
 * exercise the legacy → scoped transition from the real starting shape without touching the
 * shared dev DB. Two properties are the whole point of this file:
 *  1. an ambiguous envelope (leads in different workspaces referencing one envelope) makes
 *     the migration FAIL, and because Migrator wraps each file in one transaction nothing is
 *     half-applied;
 *  2. an envelope no lead references is NEVER deleted — its raw payload is moved intact into
 *     commercial_envelope_quarantine and can be restored by down().
 */
const dbName = `mig004_${randomUUID().replace(/-/g, '')}`;
// Parsing the URL happens even when this suite is skipped (no TEST_DATABASE_URL), so fall
// back to a syntactically valid local URL instead of throwing at module load.
const url = new URL(databaseUrl ?? 'postgres://localhost:5432/postgres');

function targetUrl(path: string): string {
  const u = new URL(url.toString());
  u.pathname = path;
  return u.toString();
}

async function maintenance(): Promise<Client> {
  const client = new Client({ connectionString: targetUrl('/postgres'), connectionTimeoutMillis: 5_000 });
  await client.connect();
  return client;
}

let admin: Client;
let dbUrl: string;

integration('migration 004 — refuses to guess, never deletes raw evidence', () => {
  beforeAll(async () => {
    admin = await maintenance();
    await admin.query(`CREATE DATABASE ${dbName}`);
    dbUrl = targetUrl(`/${dbName}`);
  });

  afterAll(async () => {
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
      await admin.end();
    }
  });

  /** Apply only the legacy part of the schema (everything before 004). */
  async function upToLegacy(): Promise<PostgresService> {
    const db = new PostgresService({ connectionString: dbUrl, max: 2 });
    const legacy = loadMigrations().filter((m) =>
      ['001_domain', '002_telemetry_feedback', '003_pilot_loop'].includes(m.version),
    );
    await new Migrator(db, legacy).up();
    return db;
  }

  async function apply004(db: PostgresService): Promise<string[]> {
    const one = loadMigrations().find((m) => m.version === '004_envelope_workspace_scope');
    if (!one) throw new Error('004 migration file not found');
    return new Migrator(db, [one]).up();
  }

  it('quarantines (does not delete) an envelope no lead references, and backfills the deterministic one', async () => {
    const db = await upToLegacy();
    const extId = `ext-${randomUUID()}`;
    await db.query("INSERT INTO workspace(id,name) VALUES ('wsA','A'),('wsB','B')");
    // deterministic: referenced by exactly one workspace
    const referenced = randomUUID();
    const orphan = randomUUID();
    const orphanPayload = { utterance: 'bằng chứng chưa được lead hoá — vẫn phải giữ', speaker: 'customer' };
    await db.query(
      `INSERT INTO commercial_envelope (id, schema_version, connection, external_record_id, external_event_type,
                                       source_captured_at, raw_payload, raw_payload_hash, is_synthetic)
       VALUES ($1,1,'pancake-page',$2,'message',now(),$3::jsonb,'hash-referenced',false),
              ($4,1,'pancake-page',$5,'message',now(),$6::jsonb,'hash-orphan',false)`,
      [referenced, `${extId}-ref`, JSON.stringify({ utterance: 'đã lead hoá', speaker: 'customer' }), orphan, `${extId}-orphan`, JSON.stringify(orphanPayload)],
    );
    await db.query(
      `INSERT INTO lead (id, workspace_id, display_name, status, attribution, source_envelope_id)
       VALUES ($1,'wsA','L1','New','unknown',$2)`,
      [randomUUID(), referenced],
    );

    expect(await apply004(db)).toEqual(['004_envelope_workspace_scope']);

    // (a) referenced envelope got the only derivable workspace, and is still in the main table
    const main = await db.query<{ id: string; workspace_id: string }>(
      'SELECT id, workspace_id FROM commercial_envelope ORDER BY id',
    );
    expect(main.rows).toHaveLength(1);
    expect(main.rows[0]).toMatchObject({ id: referenced, workspace_id: 'wsA' });

    // (b) the un-referenced envelope is NOT gone — it is in quarantine with its payload intact
    const q = await db.query<{ id: string; raw_payload: unknown; raw_payload_hash: string; is_synthetic: boolean; workspace_id: string | null; quarantine_reason: string }>(
      'SELECT id, raw_payload, raw_payload_hash, is_synthetic, workspace_id, quarantine_reason FROM commercial_envelope_quarantine',
    );
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0].id).toBe(orphan);
    expect(q.rows[0].raw_payload).toEqual(orphanPayload);
    expect(q.rows[0].raw_payload_hash).toBe('hash-orphan');
    expect(q.rows[0].is_synthetic).toBe(false); // un-marked-synthetic data must be distinguishable
    expect(q.rows[0].workspace_id).toBeNull();
    expect(q.rows[0].quarantine_reason).toContain('no lead reference');

    // (c) the scoped key + NOT NULL are in force
    const con = await db.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'commercial_envelope'::regclass AND contype = 'u'",
    );
    expect(con.rows.map((r) => r.conname)).toContain('commercial_envelope_workspace_connection_record_key');
    const nullable = await db.query<{ is_nullable: string }>(
      "SELECT is_nullable FROM information_schema.columns WHERE table_name='commercial_envelope' AND column_name='workspace_id'",
    );
    expect(nullable.rows[0]?.is_nullable).toBe('NO');

    // (d) down() restores the quarantined row instead of leaving it stranded
    await new Migrator(db, [loadMigrations().find((m) => m.version === '004_envelope_workspace_scope')!]).down(1);
    const restored = await db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM commercial_envelope WHERE id = $1',
      [orphan],
    );
    expect(restored.rows[0]?.count).toBe('1');
    // quarantine is NOT dropped by down — data survives either way until a human clears it
    const stillThere = await db.query<{ count: string }>('SELECT count(*)::text AS count FROM commercial_envelope_quarantine');
    expect(stillThere.rows[0]?.count).toBe('1');
    // and the payload is identical after restore (I-12 immutability across a migration round-trip)
    const payload = await db.query<{ raw_payload: unknown }>('SELECT raw_payload FROM commercial_envelope WHERE id = $1', [orphan]);
    expect(payload.rows[0]?.raw_payload).toEqual(orphanPayload);

    await db.onModuleDestroy();
  });

  it('REFUSES to guess when one envelope is referenced by leads in two workspaces — and leaves no half-applied schema', async () => {
    const db2Name = `${dbName}_amb`;
    await admin.query(`CREATE DATABASE ${db2Name}`);
    const ambUrl = targetUrl(`/${db2Name}`);
    try {
      const db = new PostgresService({ connectionString: ambUrl, max: 2 });
      const legacy = loadMigrations().filter((m) =>
      ['001_domain', '002_telemetry_feedback', '003_pilot_loop'].includes(m.version),
    );
      await new Migrator(db, legacy).up();

      await db.query("INSERT INTO workspace(id,name) VALUES ('wsA','A'),('wsB','B')");
      const shared = randomUUID();
      await db.query(
        `INSERT INTO commercial_envelope (id, schema_version, connection, external_record_id, external_event_type,
                                         source_captured_at, raw_payload, raw_payload_hash, is_synthetic)
         VALUES ($1,1,'pancake-page','msg-shared','message',now(),'{"utterance":"x"}'::jsonb,'h',false)`,
        [shared],
      );
      // the exact corruption the old bug produced: two tenants, one envelope row
      await db.query(
        `INSERT INTO lead (id, workspace_id, display_name, status, attribution, source_envelope_id) VALUES
         ($1,'wsA','L1','New','unknown',$3), ($2,'wsB','L2','New','unknown',$3)`,
        [randomUUID(), randomUUID(), shared],
      );

      await expect(apply004(db)).rejects.toThrow(/Refusing to guess/);

      // transactional rollback: column absent, table not created, no version recorded
      const col = await db.query<{ c: string }>(
        "SELECT count(*)::text AS c FROM information_schema.columns WHERE table_name='commercial_envelope' AND column_name='workspace_id'",
      );
      expect(col.rows[0]?.c).toBe('0');
      const qt = await db.query<{ c: string }>(
        "SELECT count(*)::text AS c FROM information_schema.tables WHERE table_name='commercial_envelope_quarantine'",
      );
      expect(qt.rows[0]?.c).toBe('0');
      const versions = await db.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version');
      expect(versions.rows.map((r) => r.version)).not.toContain('004_envelope_workspace_scope');
      // and the evidence itself is untouched — both leads still reference the same row
      const env = await db.query<{ c: string }>('SELECT count(*)::text AS c FROM commercial_envelope WHERE id = $1', [shared]);
      expect(env.rows[0]?.c).toBe('1');
      await db.onModuleDestroy();
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${db2Name} WITH (FORCE)`).catch(() => undefined);
    }
  });
});
