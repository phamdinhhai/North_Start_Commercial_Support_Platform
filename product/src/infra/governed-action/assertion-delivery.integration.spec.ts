import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GovernedActionService } from '../../application/governed-action/governed-action.service';
import type { AssertionEnvelope } from '../../domain/commercial-event/commercial-event';
import { canonicalJson } from '../../domain/governed-action/canonical-json';
import { verifyReadbackEvidenceDigest } from '../../domain/governed-action/action-outcome-assertion';
import { loadMigrations, Migrator } from '../postgres/migrator';
import { PostgresService } from '../postgres/postgres.service';
import { createHmacContentDigester, InMemoryWorkspaceKeyring } from '../../ports/content-digester';
import { AssertionDeliveryOps } from './assertion-delivery.ops';
import { PgActionStore } from './pg-action.store';
import { PgAssertionDelivery, PgAssertionInbox } from './pg-assertion-delivery';
import { createSyntheticActionPorts } from './synthetic-runtime';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite('durable assertion delivery PostgreSQL (R3 A-03)', () => {
  let db: PostgresService;
  const ws = `delivery-${randomUUID()}`;
  const schema = `delivery_${randomUUID().replaceAll('-', '')}`;
  const config = { connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` };
  const opts = { batchSize: 10, maxAttempts: 2, leaseMs: 1000, timeoutMs: 100, backoffMs: 1 };
  const adminId = randomUUID();
  const opsActor = { workspaceId: ws, userId: adminId, role: 'admin' as const, isDemo: false };
  const actor = { kind: 'human' as const, id: 'alice', workspaceId: ws };

  async function verified() {
    const target = { provider: 'synthetic-ads', accountId: 'a', resourceType: 'campaign', resourceId: randomUUID() };
    const ports = createSyntheticActionPorts({
      clock: () => new Date(),
      store: new PgActionStore(db),
      enabled: [{ workspaceId: ws, capabilityId: 'ads.campaign.budget.update' }],
      policy: {
        constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 600_000 },
        proposers: '*', approvers: ['bob'], executors: ['alice'],
      },
    });
    ports.ledger.seed({ workspaceId: ws, target }, { dailyBudget: { amountMinor: '100', currency: 'VND' } });
    const executeSpy = vi.spyOn(ports.executor, 'execute');
    const service = new GovernedActionService({ ...ports, executionTimeoutMs: 50, readbackTimeoutMs: 50 });
    const p = await service.propose(actor, {
      requestKey: randomUUID(), capabilityId: 'ads.campaign.budget.update', target,
      arguments: { dailyBudget: { amountMinor: '110', currency: 'VND' } }, rationale: 'test',
    });
    const pv = await service.preview(actor, p.id);
    await service.authorize({ ...actor, id: 'bob' }, p.id, {
      reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: pv.preview!.previewDigest, reason: 'ok',
    });
    return { service, ports, executeSpy, p };
  }

  beforeAll(async () => {
    const admin = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.onModuleDestroy(); }
    db = new PostgresService(config);
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace(id,name) VALUES ($1,$1)', [ws]);
    await db.query('INSERT INTO platform_user(id) VALUES ($1)', [adminId]);
  });

  afterAll(async () => {
    if (db) {
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      await db.onModuleDestroy();
    }
  });

  it('atomically persists outcome and immutable envelope, survives restart, and deduplicates inbox without provider redispatch', async () => {
    const { service, executeSpy, p } = await verified();
    await service.execute(actor, p.id);
    expect(executeSpy).toHaveBeenCalledTimes(1);

    const inbox = new PgAssertionInbox(db);
    const worker = new PgAssertionDelivery(db, inbox, opts);
    expect((await worker.inspect(ws))[0]).toMatchObject({ status: 'PENDING', attempts: 0 });
    const queued = (await db.query<{ envelope: AssertionEnvelope }>(
      'SELECT envelope FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2', [ws, p.id])).rows[0].envelope;

    // Optional actual restart of an explicitly owned private cluster; never an existing service.
    if (process.env.REL_PRIVATE_PG_DATA) {
      const data = resolve(process.env.REL_PRIVATE_PG_DATA);
      if (!/north-r46-rel-[a-f0-9]{32}[\\/]data$/i.test(data) || !process.env.TEST_DATABASE_URL?.includes('127.0.0.1:55467/north_rel_test')) {
        throw Error('PRIVATE_CLUSTER_REQUIRED');
      }
      await db.onModuleDestroy();
      const ctl = 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe';
      const restart = spawnSync(ctl, ['-D', data, '-l', resolve(data, '../server.log'), '-m', 'fast', '-w', 'restart'], { stdio: 'ignore', timeout: 30000 });
      expect(restart.status).toBe(0);
    }
    const other = new PostgresService(config);
    try { await new PgAssertionDelivery(other, new PgAssertionInbox(other), opts).runOnce(); } finally { await other.onModuleDestroy(); }

    expect((await worker.inspect(ws))[0].status).toBe('DELIVERED');
    expect(executeSpy).toHaveBeenCalledTimes(1);
    const delivered = (await db.query<{ envelope: AssertionEnvelope }>(
      'SELECT envelope FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2', [ws, queued.assertionId])).rows[0].envelope;
    expect(canonicalJson(delivered as unknown as Record<string, unknown>)).toBe(canonicalJson(queued as unknown as Record<string, unknown>));

    await inbox.emit(delivered);
    await inbox.emit(delivered);
    expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2', [ws, queued.assertionId])).rowCount).toBe(1);
  });

  it('rolls back action CAS and event when outbox insert fails on execute or verify, and preserves UNKNOWN without emitting', async () => {
    const { service, ports, executeSpy, p } = await verified();
    ports.executor.behaviour = 'apply-then-hang';
    expect((await service.execute(actor, p.id)).state).toBe('UNKNOWN');
    expect((await db.query('SELECT 1 FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2', [ws, p.id])).rowCount).toBe(0);
    expect(executeSpy).toHaveBeenCalledTimes(1);

    await db.query(`CREATE FUNCTION fail_outbox_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test outbox unavailable'; END $$`);
    await db.query('CREATE TRIGGER fail_outbox_test BEFORE INSERT ON assertion_outbox FOR EACH ROW EXECUTE FUNCTION fail_outbox_test()');
    const direct = await verified();
    try {
      await expect(service.verify(actor, p.id)).rejects.toThrow('outbox unavailable');
      await expect(direct.service.execute(actor, direct.p.id)).rejects.toThrow('outbox unavailable');
    } finally {
      await db.query('DROP TRIGGER fail_outbox_test ON assertion_outbox');
      await db.query('DROP FUNCTION fail_outbox_test()');
    }

    expect((await new PgActionStore(db).get(ws, p.id))?.state).toBe('UNKNOWN');
    expect((await new PgActionStore(db).events(ws, p.id)).at(-1)?.toState).toBe('UNKNOWN');
    expect((await new PgActionStore(db).get(ws, direct.p.id))?.state).toBe('EXECUTING');
    expect((await new PgActionStore(db).events(ws, direct.p.id)).at(-1)?.toState).toBe('EXECUTING');

    // Once outbox recovers, verify resolves UNKNOWN atomically without re-executing provider
    expect((await service.verify(actor, p.id)).state).toBe('SUCCEEDED_VERIFIED');
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect((await db.query('SELECT 1 FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2', [ws, p.id])).rowCount).toBe(1);
    await new PgAssertionDelivery(db, new PgAssertionInbox(db), opts).runOnce();
  });

  it('bounds retries during sink outage, shows categorical failure, scopes replay and delivers exact immutable envelope on recovery', async () => {
    const { service, executeSpy, p } = await verified();
    await service.execute(actor, p.id);
    const before = (await db.query<{ envelope: AssertionEnvelope }>(
      'SELECT envelope FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2', [ws, p.id])).rows[0].envelope;
    const fail = new PgAssertionDelivery(db, { emit: async () => { throw new Error('sensitive secret'); } }, opts);
    await fail.runOnce();
    await db.query("UPDATE assertion_outbox SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE workspace_id=$1 AND proposal_id=$2 AND status='PENDING'", [ws, p.id]);
    await fail.runOnce();

    const failed = (await fail.inspect(ws)).find((r) => r.assertionId === before.assertionId)!;
    expect(failed).toMatchObject({ status: 'FAILED', attempts: 2, lastError: 'SINK_FAILED' });

    const ops = new AssertionDeliveryOps(db);
    const original = { ...process.env };
    Object.assign(process.env, { AUTH_MODE: 'oidc', ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'postgres', DATABASE_URL: process.env.TEST_DATABASE_URL });
    try {
      await expect(ops.change({ ...opsActor, workspaceId: 'foreign' }, failed.assertionId, 'replay')).rejects.toThrow('DELIVERY_CONFLICT');
      await ops.change(opsActor, failed.assertionId, 'replay');
      expect((await db.query('SELECT 1 FROM assertion_delivery_audit WHERE workspace_id=$1 AND assertion_id=$2', [ws, failed.assertionId])).rowCount).toBe(1);
    } finally { process.env = original; }

    await new PgAssertionDelivery(db, new PgAssertionInbox(db), opts).runOnce();
    expect((await fail.inspect(ws)).find((r) => r.assertionId === failed.assertionId)?.status).toBe('DELIVERED');
    expect(executeSpy).toHaveBeenCalledTimes(1);
    const after = (await db.query<{ envelope: AssertionEnvelope }>(
      'SELECT envelope FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2', [ws, before.assertionId])).rows[0].envelope;
    expect(canonicalJson(after as unknown as Record<string, unknown>)).toBe(canonicalJson(before as unknown as Record<string, unknown>));
  });

  it('quarantines persisted poison, detects conflicting duplicate evidence in outbox and inbox, and refuses append-only mutation', async () => {
    const { service, p } = await verified();
    await service.execute(actor, p.id);
    const row = (await db.query<{ envelope: AssertionEnvelope }>('SELECT envelope FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2', [ws, p.id])).rows[0];
    const poisonId = randomUUID();
    await db.query(`INSERT INTO assertion_outbox(workspace_id,assertion_id,proposal_id,event_sequence,envelope)
      SELECT workspace_id,$3,proposal_id,event_sequence,'{}'::jsonb FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2`, [ws, p.id, poisonId]);

    const worker = new PgAssertionDelivery(db, new PgAssertionInbox(db), opts);
    await worker.runOnce();
    expect((await worker.inspect(ws)).find((x) => x.assertionId === poisonId)).toMatchObject({ status: 'FAILED', attempts: 1, lastError: 'INVALID_ENVELOPE' });
    expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2', [ws, poisonId])).rowCount).toBe(0);

    // Conflicting replay into inbox directly and via outbox conflict quarantine
    await expect(new PgAssertionInbox(db).emit({ ...row.envelope, value: 'changed' })).rejects.toThrow('ENVELOPE_CONFLICT');
    const conflictId = randomUUID();
    const validConflict = { ...row.envelope, assertionId: conflictId as AssertionEnvelope['assertionId'] };
    await new PgAssertionInbox(db).emit({ ...validConflict, value: 'NOT_EXECUTED' });
    await db.query(`INSERT INTO assertion_outbox(workspace_id,assertion_id,proposal_id,event_sequence,envelope)
      SELECT workspace_id,$3,proposal_id,event_sequence,$4::jsonb FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2 LIMIT 1`,
      [ws, p.id, conflictId, JSON.stringify(validConflict)]);
    await worker.runOnce();
    expect((await worker.inspect(ws)).find((x) => x.assertionId === conflictId)).toMatchObject({ status: 'FAILED', attempts: 1, lastError: 'ENVELOPE_CONFLICT' });

    for (const sql of [
      `UPDATE assertion_inbox SET envelope='{}'::jsonb WHERE workspace_id='${ws}'`,
      `DELETE FROM assertion_inbox WHERE workspace_id='${ws}'`,
      'TRUNCATE assertion_inbox',
      `DELETE FROM assertion_outbox WHERE workspace_id='${ws}'`,
      'TRUNCATE assertion_outbox CASCADE',
    ]) {
      await expect(db.query(sql)).rejects.toThrow();
    }
  });

  it('atomically audits admin stop/replay, blocks ENVELOPE_CONFLICT replay, and rolls back mutation when audit fails', async () => {
    const { service, p } = await verified();
    await service.execute(actor, p.id);
    const outboxRow = (await db.query<{ envelope: AssertionEnvelope }>('SELECT envelope FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2', [ws, p.id])).rows[0];
    const conflictId = randomUUID();
    const validConflict = { ...outboxRow.envelope, assertionId: conflictId as AssertionEnvelope['assertionId'] };
    await new PgAssertionInbox(db).emit({ ...validConflict, value: 'NOT_EXECUTED' });
    await db.query(`INSERT INTO assertion_outbox(workspace_id,assertion_id,proposal_id,event_sequence,envelope,status,attempts,last_error)
      SELECT workspace_id,$3,proposal_id,event_sequence,$4::jsonb,'FAILED',1,'ENVELOPE_CONFLICT' FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2 LIMIT 1`,
      [ws, p.id, conflictId, JSON.stringify(validConflict)]);
    const id = outboxRow.envelope.assertionId;
    const original = { ...process.env };
    Object.assign(process.env, { AUTH_MODE: 'oidc', ASSERTION_DELIVERY_ENABLED: 'true', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'postgres', DATABASE_URL: process.env.TEST_DATABASE_URL });
    try {
      const ops = new AssertionDeliveryOps(db);
      await expect(ops.change(opsActor, conflictId, 'replay')).rejects.toThrow('DELIVERY_CONFLICT');
      await expect(ops.change({ ...opsActor, userId: randomUUID() }, id, 'stop')).rejects.toThrow();
      expect((await ops.inspect(opsActor)).find((x) => x.assertionId === id)?.status).toBe('PENDING');
      await ops.change(opsActor, id, 'stop');
      expect((await ops.inspect(opsActor)).find((x) => x.assertionId === id)?.lastError).toBe('OPERATOR_STOP');
      await expect(db.query('DELETE FROM assertion_delivery_audit WHERE workspace_id=$1', [ws])).rejects.toThrow();
      await ops.change(opsActor, id, 'replay');
      await new PgAssertionDelivery(db, new PgAssertionInbox(db), opts).runOnce();
    } finally { process.env = original; }
  });

  it('recovers crash-after-sink-before-ack via expired lease and fences stale worker acknowledgement after lease takeover', async () => {
    const { service, p } = await verified();
    await service.execute(actor, p.id);
    const row = (await db.query<{ envelope: AssertionEnvelope; assertion_id: string }>(
      "SELECT envelope,assertion_id FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2 AND status='PENDING'", [ws, p.id])).rows[0];

    // Crash after sink wrote inbox before outbox acknowledgement: expired lease reclaims and marks DELIVERED idempotently
    await new PgAssertionInbox(db).emit(row.envelope);
    await db.query("UPDATE assertion_outbox SET status='LEASED',attempts=1,lease_token=$3,lease_until=clock_timestamp()-interval '1 second' WHERE workspace_id=$1 AND assertion_id=$2",
      [ws, row.assertion_id, randomUUID()]);
    await new PgAssertionDelivery(db, new PgAssertionInbox(db), opts).runOnce();
    expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2', [ws, row.assertion_id])).rowCount).toBe(1);
    expect((await new PgAssertionDelivery(db, new PgAssertionInbox(db), opts).inspect(ws)).find((x) => x.assertionId === row.assertion_id)?.status).toBe('DELIVERED');

    // Stale worker fencing: worker A hangs past leaseMs, worker B reclaims and fails/re-queues or delivers; A's late failure cannot overwrite B's state
    const second = await verified();
    await second.service.execute(actor, second.p.id);
    const id2 = (await db.query<{ assertion_id: string }>(
      'SELECT assertion_id FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2', [ws, second.p.id])).rows[0].assertion_id;
    let releaseSlow!: () => void;
    const slowEntered = new Promise<void>((res) => {
      const slowWorker = new PgAssertionDelivery(db, {
        emit: async () => {
          res();
          await new Promise<void>((r) => { releaseSlow = r; });
          throw new Error('late stale worker failure');
        },
      }, { batchSize: 1, maxAttempts: 4, leaseMs: 60, timeoutMs: 50, backoffMs: 1 });
      void slowWorker.runOnce();
    });
    await slowEntered;
    await new Promise((r) => setTimeout(r, 90));
    await new PgAssertionDelivery(db, new PgAssertionInbox(db), { batchSize: 5, maxAttempts: 4, leaseMs: 1000, timeoutMs: 200, backoffMs: 1 }).runOnce();
    releaseSlow();
    await new Promise((r) => setTimeout(r, 30));
    expect((await new PgAssertionDelivery(db, new PgAssertionInbox(db), opts).inspect(ws)).find((x) => x.assertionId === id2))
      .toMatchObject({ status: 'DELIVERED', lastError: null });
  });

  it('mints distinct per-row lease tokens in batch claims and prevents duplicate sink invocation across concurrent workers', async () => {
    const a = await verified();
    const b = await verified();
    await a.service.execute(actor, a.p.id);
    await b.service.execute(actor, b.p.id);

    const seenTokens = new Set<string>();
    let calls = 0;
    const sink = {
      emit: async (e: AssertionEnvelope) => {
        calls++;
        const tok = (await db.query<{ lease_token: string }>(
          'SELECT lease_token FROM assertion_outbox WHERE workspace_id=$1 AND assertion_id=$2', [ws, e.assertionId])).rows[0]?.lease_token;
        if (tok) seenTokens.add(tok);
        await new PgAssertionInbox(db).emit(e);
      },
    };
    await Promise.all([new PgAssertionDelivery(db, sink, opts).runOnce(), new PgAssertionDelivery(db, sink, opts).runOnce()]);
    expect(calls).toBe(2);
    expect(seenTokens.size).toBe(2);
  });

  it('reclaims expired leases, marks exhausted expired leases FAILED, and preserves schema rollback symmetry', async () => {
    const { service, p } = await verified();
    await service.execute(actor, p.id);
    await db.query("UPDATE assertion_outbox SET status='LEASED',attempts=2,lease_token=$2,lease_until=clock_timestamp()-interval '1 second' WHERE workspace_id=$1 AND proposal_id=$3",
      [ws, randomUUID(), p.id]);
    await new PgAssertionDelivery(db, new PgAssertionInbox(db), opts).runOnce();
    expect((await new PgAssertionDelivery(db, new PgAssertionInbox(db), opts).inspect(ws)).find((r) => r.lastError === 'LEASE_EXPIRED'))
      .toMatchObject({ status: 'FAILED', attempts: 2, lastError: 'LEASE_EXPIRED' });
    await expect(db.query("UPDATE assertion_outbox SET envelope='{}' WHERE workspace_id=$1", [ws])).rejects.toThrow('immutable');

    const migrations = loadMigrations().filter((m) => m.version >= '014_assertion_delivery');
    await db.withTransaction(async (tx) => {
      const rollbackSchema = `delivery_rollback_${randomUUID().replaceAll('-', '')}`;
      await tx.query(`CREATE SCHEMA ${rollbackSchema}`);
      await tx.query(`SET LOCAL search_path TO ${rollbackSchema}`);
      for (const m of loadMigrations()) await tx.query(m.up);
      for (const m of [...migrations].reverse()) await tx.query(m.down);
      for (const m of migrations) await tx.query(m.up);
      await tx.query('SET LOCAL search_path TO public');
      await tx.query(`DROP SCHEMA ${rollbackSchema} CASCADE`);
    });
  });
});


const a02Suite=process.env.TEST_DATABASE_URL ? describe : describe.skip;
a02Suite('durable assertion delivery PostgreSQL',()=>{
 let db:PostgresService;
 const ws=`delivery-${randomUUID()}`;
 const schema=`delivery_${randomUUID().replaceAll('-','')}`;
 const config={connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`};
 const opts={batchSize:10,maxAttempts:2,leaseMs:1000,timeoutMs:100,backoffMs:1};
 const adminId=randomUUID();
 const opsActor={workspaceId:ws,userId:adminId,role:'admin' as const,isDemo:false};
 const actor={kind:'human' as const,id:'alice',workspaceId:ws};
 async function verified(){
  const target={provider:'synthetic-ads',accountId:'a',resourceType:'campaign',resourceId:randomUUID()};
  const ports=createSyntheticActionPorts({clock:()=>new Date(),store:new PgActionStore(db),enabled:[{workspaceId:ws,capabilityId:'ads.campaign.budget.update'}],
   policy:{constraints:{maxBudgetDeltaPercent:20,protectedAccountIds:[],approvalTtlMs:600000},proposers:'*',approvers:['bob'],executors:['alice']}});
  ports.ledger.seed({workspaceId:ws,target},{dailyBudget:{amountMinor:'100',currency:'VND'}});
  const service=new GovernedActionService(ports);
  const p=await service.propose(actor,{requestKey:randomUUID(),capabilityId:'ads.campaign.budget.update',target,arguments:{dailyBudget:{amountMinor:'110',currency:'VND'}},rationale:'test'});
  const pv=await service.preview(actor,p.id);
  await service.authorize({...actor,id:'bob'},p.id,{reviewedArgumentDigest:p.argumentDigest,reviewedPreviewDigest:pv.preview!.previewDigest,reason:'ok'});
  return {service,p};
 }
 beforeAll(async()=>{const admin=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});try{await admin.query(`CREATE SCHEMA ${schema}`);}finally{await admin.onModuleDestroy();} db=new PostgresService(config);await new Migrator(db,loadMigrations()).up();await db.query('INSERT INTO workspace(id,name) VALUES ($1,$1)',[ws]);await db.query('INSERT INTO platform_user(id) VALUES ($1)',[adminId]);});
 afterAll(async()=>{if(db){await db.query(`DROP SCHEMA ${schema} CASCADE`);await db.onModuleDestroy();}});
 it('atomically persists outcome and envelope, survives restart and deduplicates inbox',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const inbox=new PgAssertionInbox(db);const worker=new PgAssertionDelivery(db,inbox,opts);
  expect((await worker.inspect(ws))[0]).toMatchObject({status:'PENDING',attempts:0});
  // Optional actual restart of an explicitly owned private cluster; never an existing service.
  if (process.env.REL_PRIVATE_PG_DATA) {
   const data=resolve(process.env.REL_PRIVATE_PG_DATA);
   if (!/north-r46-rel-[a-f0-9]{32}[\\/]data$/i.test(data) || !process.env.TEST_DATABASE_URL?.includes('127.0.0.1:55467/north_rel_test')) throw Error('PRIVATE_CLUSTER_REQUIRED');
   await db.onModuleDestroy();
   const ctl='C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe';
   const restart=spawnSync(ctl,['-D',data,'-l',resolve(data,'../server.log'),'-m','fast','-w','restart'],{stdio:'ignore',timeout:30000});
   expect(restart.status).toBe(0);
  }
  const other=new PostgresService(config);
  try{await new PgAssertionDelivery(other,new PgAssertionInbox(other),opts).runOnce();}finally{await other.onModuleDestroy();}
  expect((await worker.inspect(ws))[0].status).toBe('DELIVERED');
  const row=(await db.query<{envelope:AssertionEnvelope}>('SELECT envelope FROM assertion_inbox WHERE workspace_id=$1',[ws])).rows[0];
  expect(row.envelope.rawPayloadDigest).toMatchObject({algorithm_version:'hmac-sha256-v1',kid:expect.any(String),value:expect.stringMatching(/^[a-f0-9]{64}$/)});
  expect(row.envelope.rawPayloadHash).toBe(`hmac-sha256-v1:${row.envelope.rawPayloadDigest!.kid}:${row.envelope.rawPayloadDigest!.value}`);
  await inbox.emit(row.envelope);await inbox.emit(row.envelope);
  expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1',[ws])).rowCount).toBe(1);
 });
 it('persists workspace-separated keyed readback digests and surfaces UNKNOWN when historical key is missing (A-02 / ADR-009)',async()=>{
  const wsOther=`delivery-other-${randomUUID()}`;
  await db.query('INSERT INTO workspace(id,name) VALUES ($1,$1)',[wsOther]);
  const ring=new InMemoryWorkspaceKeyring(),secret=randomBytes(32);
  ring.rotate(ws,'rot-k1',secret);ring.rotate(wsOther,'rot-k1',secret);
  const digester=createHmacContentDigester(ring);
  const runFor=async(tenant:string)=>{
   const target={provider:'synthetic-ads',accountId:'a',resourceType:'campaign',resourceId:randomUUID()};
   const ports=createSyntheticActionPorts({clock:()=>new Date(),store:new PgActionStore(db),digester,enabled:[{workspaceId:tenant,capabilityId:'ads.campaign.budget.update'}],
    policy:{constraints:{maxBudgetDeltaPercent:20,protectedAccountIds:[],approvalTtlMs:600000},proposers:'*',approvers:['bob'],executors:['alice']}});
   ports.ledger.seed({workspaceId:tenant,target},{dailyBudget:{amountMinor:'100',currency:'VND'}});
   const verifier={readCurrentState:(r:Parameters<typeof ports.verifier.readCurrentState>[0])=>ports.verifier.readCurrentState(r),
    readback:async(r:Parameters<typeof ports.verifier.readback>[0])=>({...(await ports.verifier.readback(r)),evidence:{phone:'0901234567',orderCode:'DH-01'}})};
   const service=new GovernedActionService({...ports,verifier,digester});
   const who={kind:'human' as const,id:'alice',workspaceId:tenant};
   const p=await service.propose(who,{requestKey:randomUUID(),capabilityId:'ads.campaign.budget.update',target,arguments:{dailyBudget:{amountMinor:'110',currency:'VND'}},rationale:'a02'});
   const pv=await service.preview(who,p.id);
   await service.authorize({...who,id:'bob'},p.id,{reviewedArgumentDigest:p.argumentDigest,reviewedPreviewDigest:pv.preview!.previewDigest,reason:'ok'});
   await service.execute(who,p.id);
   await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce();
   return (await db.query<{envelope:AssertionEnvelope}>('SELECT envelope FROM assertion_inbox WHERE workspace_id=$1 ORDER BY received_at DESC LIMIT 1',[tenant])).rows[0].envelope;
  };
  const envA=await runFor(ws);const envB=await runFor(wsOther);
  expect(envA.rawPayloadDigest).toEqual({algorithm_version:'hmac-sha256-v1',kid:'rot-k1',value:expect.stringMatching(/^[a-f0-9]{64}$/)});
  expect(envB.rawPayloadDigest!.value).not.toBe(envA.rawPayloadDigest!.value);
  ring.rotate(ws,'rot-k2',randomBytes(32));
  expect(verifyReadbackEvidenceDigest(ws,{phone:'0901234567',orderCode:'DH-01'},envA.rawPayloadDigest!,digester)).toBe(true);
  const freshRing=new InMemoryWorkspaceKeyring();freshRing.rotate(ws,'rot-k2',randomBytes(32));
  expect(verifyReadbackEvidenceDigest(ws,{phone:'0901234567',orderCode:'DH-01'},envA.rawPayloadDigest!,createHmacContentDigester(freshRing))).toBe('UNKNOWN');
 });
 it('rolls back action CAS and event when outbox insert fails',async()=>{
  const {service,p}=await verified();
  await db.query(`CREATE FUNCTION fail_outbox_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test outbox unavailable'; END $$`);
  await db.query('CREATE TRIGGER fail_outbox_test BEFORE INSERT ON assertion_outbox FOR EACH ROW EXECUTE FUNCTION fail_outbox_test()');
  try{await expect(service.execute(actor,p.id)).rejects.toThrow('outbox unavailable');}finally{await db.query('DROP TRIGGER fail_outbox_test ON assertion_outbox');await db.query('DROP FUNCTION fail_outbox_test()');}
  expect((await new PgActionStore(db).get(ws,p.id))?.state).toBe('EXECUTING');
  expect((await new PgActionStore(db).events(ws,p.id)).at(-1)?.toState).toBe('EXECUTING');
 });
 it('bounds retries, shows categorical failure, scopes replay and delivers after recovery',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const fail=new PgAssertionDelivery(db,{emit:async()=>{throw new Error('sensitive secret');}},opts);
  await fail.runOnce();await db.query("UPDATE assertion_outbox SET next_attempt_at=now()-interval '1 second' WHERE workspace_id=$1 AND status='PENDING'",[ws]);await fail.runOnce();
  const failed=(await fail.inspect(ws)).find(r=>r.status==='FAILED')!;
  expect(failed).toMatchObject({attempts:2,lastError:'SINK_FAILED'});
  const ops=new AssertionDeliveryOps(db);
  const original={...process.env};
  Object.assign(process.env,{AUTH_MODE:'oidc',ASSERTION_DELIVERY_ENABLED:'true',DEPLOYMENT_MODE:'test',PILOT_STORE_MODE:'postgres',DATABASE_URL:process.env.TEST_DATABASE_URL});
  try {
   await expect(ops.change({...opsActor,workspaceId:'foreign'},failed.assertionId,'replay')).rejects.toThrow('DELIVERY_CONFLICT');
   await ops.change(opsActor,failed.assertionId,'replay');
   expect((await db.query('SELECT 1 FROM assertion_delivery_audit WHERE workspace_id=$1 AND assertion_id=$2',[ws,failed.assertionId])).rowCount).toBe(1);
  } finally {process.env=original;}
  await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce();
  expect((await fail.inspect(ws)).find(r=>r.assertionId===failed.assertionId)?.status).toBe('DELIVERED');
 });
 it('quarantines persisted poison and detects conflicting duplicate evidence',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const row=(await db.query<{envelope:AssertionEnvelope}>('SELECT envelope FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2',[ws,p.id])).rows[0];
  const poisonId=randomUUID();
  await db.query(`INSERT INTO assertion_outbox(workspace_id,assertion_id,proposal_id,event_sequence,envelope)
   SELECT workspace_id,$3,proposal_id,event_sequence,'{}'::jsonb FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2`,[ws,p.id,poisonId]);
  const worker=new PgAssertionDelivery(db,new PgAssertionInbox(db),opts);await worker.runOnce();
  expect((await worker.inspect(ws)).find(x=>x.assertionId===poisonId)).toMatchObject({status:'FAILED',attempts:1,lastError:'INVALID_ENVELOPE'});
  expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2',[ws,poisonId])).rowCount).toBe(0);
  await expect(new PgAssertionInbox(db).emit({...row.envelope,value:'changed'})).rejects.toThrow('ENVELOPE_CONFLICT');
 });
 it('atomically audits admin stop/replay and rolls back mutation when audit fails',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const id=(await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).inspect(ws)).find(x=>x.status==='PENDING')!.assertionId;
  const original={...process.env};
  Object.assign(process.env,{AUTH_MODE:'oidc',ASSERTION_DELIVERY_ENABLED:'true',DEPLOYMENT_MODE:'test',PILOT_STORE_MODE:'postgres',DATABASE_URL:process.env.TEST_DATABASE_URL});
  try{
   const ops=new AssertionDeliveryOps(db);
   await expect(ops.change({...opsActor,userId:randomUUID()},id,'stop')).rejects.toThrow();
   expect((await ops.inspect(opsActor)).find(x=>x.assertionId===id)?.status).toBe('PENDING');
   await ops.change(opsActor,id,'stop');
   expect((await ops.inspect(opsActor)).find(x=>x.assertionId===id)?.lastError).toBe('OPERATOR_STOP');
   await expect(db.query('DELETE FROM assertion_delivery_audit WHERE workspace_id=$1',[ws])).rejects.toThrow();
   await ops.change(opsActor,id,'replay');
   await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce();
  }finally{process.env=original;}
 });
 it('simulates crash after inbox commit before acknowledgement and recovers duplicate by expired lease',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const row=(await db.query<{envelope:AssertionEnvelope;assertion_id:string}>('SELECT envelope,assertion_id FROM assertion_outbox WHERE workspace_id=$1 AND status=\'PENDING\'',[ws])).rows[0];
  await new PgAssertionInbox(db).emit(row.envelope);
  await db.query("UPDATE assertion_outbox SET status='LEASED',attempts=1,lease_token=$3,lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND assertion_id=$2",[ws,row.assertion_id,randomUUID()]);
  await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce();
  expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2',[ws,row.assertion_id])).rowCount).toBe(1);
  expect((await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).inspect(ws)).find(x=>x.assertionId===row.assertion_id)?.status).toBe('DELIVERED');
 });
 it('concurrent workers invoke one sink per fresh lease',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);let calls=0;
  const sink={emit:async(e:AssertionEnvelope)=>{calls++;await new PgAssertionInbox(db).emit(e);}};
  await Promise.all([new PgAssertionDelivery(db,sink,opts).runOnce(),new PgAssertionDelivery(db,sink,opts).runOnce()]);
  expect(calls).toBe(1);
 });
 it('reclaims expired leases and never overwrites immutable evidence',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  await db.query("UPDATE assertion_outbox SET status='LEASED',attempts=1,lease_token=$2,lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND status='PENDING'",[ws,randomUUID()]);
  await Promise.all([new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce(),new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce()]);
  expect((await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).inspect(ws)).some(r=>r.status==='LEASED')).toBe(false);
  await expect(db.query("UPDATE assertion_outbox SET envelope='{}' WHERE workspace_id=$1",[ws])).rejects.toThrow('immutable');
  const migrations=loadMigrations().filter(m=>m.version >= '014_assertion_delivery');
  await db.withTransaction(async tx=>{
   const schema=`delivery_rollback_${randomUUID().replaceAll('-','')}`;
   await tx.query(`CREATE SCHEMA ${schema}`);await tx.query(`SET LOCAL search_path TO ${schema}`);
   for(const m of loadMigrations())await tx.query(m.up);
   for(const m of [...migrations].reverse())await tx.query(m.down);for(const m of migrations)await tx.query(m.up);
   await tx.query('SET LOCAL search_path TO public');await tx.query(`DROP SCHEMA ${schema} CASCADE`);
  });
 });
});
