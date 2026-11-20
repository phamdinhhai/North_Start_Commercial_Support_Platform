import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PgSourceIntegrationStore } from '../source-integration/pg-source-integration.store';
import { installContentDigester } from '../../ports/content-digester-runtime';
import { configuredContentDigester } from '../crypto/configured-content-digester';
import type { AuthContext } from '../../ports/auth';
import type { SourceReceipt } from '../../ports/source-observation';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('021 additive immutable receipt tuple guard', () => {
  let db: PostgresService, connectionId: string, source: SourceReceipt, other: SourceReceipt, foreign: SourceReceipt;
  const ctx: AuthContext = { workspaceId: `guard-${randomUUID()}`, userId: 'fabricated-admin', role: 'admin', isDemo: false };
  const files = loadMigrations(), guard = files.find(m => m.version === '021_source_link_receipt_guard')!;
  const older = files.filter(m => m.version < guard.version);
  const snapshot = async () => (await db.query('SELECT to_jsonb(l) AS row FROM source_episode_link l ORDER BY id')).rows;
  async function append(receipt: SourceReceipt, envelope = receipt.envelopeId, origin = receipt.leadId) {
    await db.query(`INSERT INTO source_episode_link(id,workspace_id,connection_id,receipt_id,lead_id,origin_lead_id,effective_lead_id,envelope_id,version,action,reason,actor_id,idempotency_key,command_digest)
      VALUES($1,$2,$3,$4,$5,$6,$5,$7,$8,'link','fabricated reason',$9,$10,'{}')`,
    [randomUUID(),ctx.workspaceId,connectionId,receipt.receiptId,receipt.leadId,origin,envelope,
      1 + Number((await db.query('SELECT count(*)::int n FROM source_episode_link WHERE workspace_id=$1 AND connection_id=$2 AND receipt_id=$3',[ctx.workspaceId,connectionId,receipt.receiptId])).rows[0].n),ctx.userId,randomUUID()]);
  }
  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    await new Migrator(db,older).up();
    installContentDigester(configuredContentDigester({ NODE_ENV: 'test' }));
    const store = new PgSourceIntegrationStore(db);
    async function seed(c: AuthContext) {
      await db.query('INSERT INTO workspace(id,name) VALUES($1,$1) ON CONFLICT DO NOTHING',[c.workspaceId]);
      const connection = await store.createConnection(c,{ provider:'pancake',route:'pancake-synthetic',pageId:'fabricated-page' });
      if(c.workspaceId===ctx.workspaceId) connectionId=connection.id;
      const observation = () => ({schemaVersion:1 as const,accountId:'fabricated-page',provider:'pancake' as const,route:'pancake-synthetic' as const,synthetic:true as const,sourceAuthority:'synthetic_fixture' as const,completeness:'UNKNOWN' as const,verification:'UNVERIFIED' as const,receiptId:randomUUID(),native:{system:'pancake' as const,pageId:'fabricated-page',conversationId:null,messageId:randomUUID(),eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed' as const,displayName:'Fabricated',rawPayload:{utterance:'Fabricated',speaker:'customer' as const,original:{synthetic:true}}});
      return [await store.intake(c,connection.id,observation(),{claimResponsibility:true}),await store.intake(c,connection.id,observation(),{claimResponsibility:true})];
    }
    [source,other] = await seed(ctx);
    [foreign] = await seed({...ctx,workspaceId:`foreign-${randomUUID()}`});
    await append(source);
  });
  afterAll(async () => db?.onModuleDestroy());
  it('upgrades valid 020 history unchanged, rejects wrong/foreign envelopes and wrong origin, down/up retains bytes', async () => {
    const before = await snapshot();
    expect(await new Migrator(db,files).up()).toEqual([guard.version]);
    expect(await snapshot()).toEqual(before);
    for(const envelope of [other.envelopeId,foreign.envelopeId]) await expect(append(source,envelope)).rejects.toThrow('source link receipt evidence mismatch');
    await expect(append(source,source.envelopeId,other.leadId)).rejects.toThrow('source link receipt evidence mismatch');
    expect(await snapshot()).toEqual(before);
    await append(other);
    const accepted = await snapshot();
    expect(await new Migrator(db,files).down(1)).toEqual([guard.version]);
    expect(await snapshot()).toEqual(accepted);
    expect(await new Migrator(db,files).up()).toEqual([guard.version]);
    expect(await snapshot()).toEqual(accepted);
  });
  it('refuses inconsistent preexisting history transactionally without rewriting it', async () => {
    // Roll back this deliberately inconsistent 020 fixture; it must never persist in test DB.
    await expect(db.withTransaction(async tx => {
      await tx.query(guard.down);
      await tx.query(`INSERT INTO source_episode_link(id,workspace_id,connection_id,receipt_id,lead_id,origin_lead_id,effective_lead_id,envelope_id,version,action,reason,actor_id,idempotency_key,command_digest)
        VALUES($1,$2,$3,$4,$5,$6,$5,$7,99,'link','fabricated invalid legacy',$8,$9,'{}')`,
      [randomUUID(),ctx.workspaceId,connectionId,source.receiptId,source.leadId,other.leadId,other.envelopeId,ctx.userId,randomUUID()]);
      const before = (await tx.query('SELECT to_jsonb(l) row FROM source_episode_link l ORDER BY id')).rows;
      await tx.query('SAVEPOINT attempted_upgrade');
      try { await tx.query(guard.up); } catch (error) {
        await tx.query('ROLLBACK TO SAVEPOINT attempted_upgrade');
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('source link receipt guard refuses inconsistent existing history');
        expect((await tx.query('SELECT to_jsonb(l) row FROM source_episode_link l ORDER BY id')).rows).toEqual(before);
        throw new Error('confirmed refusal without rewrite');
      }
      throw new Error('upgrade unexpectedly accepted corrupt history');
    })).rejects.toThrow('confirmed refusal without rewrite');
    await expect(append(source,other.envelopeId)).rejects.toThrow('source link receipt evidence mismatch');
  });
});
