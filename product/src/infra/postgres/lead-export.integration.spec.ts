import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PostgresService} from './postgres.service';
import {Migrator,loadMigrations} from './migrator';
import {PgLeadExportStore} from './pg-lead-export.store';
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('audited single-lead PostgreSQL export',()=>{
 let db:PostgresService;let store:PgLeadExportStore;
 const ws=`export-${randomUUID()}`,other=`foreign-${randomUUID()}`,lead=randomUUID();
 beforeAll(async()=>{db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});await new Migrator(db,loadMigrations()).up();store=new PgLeadExportStore(db);
  await db.query('INSERT INTO workspace(id,name) VALUES ($1,$1),($2,$2)',[ws,other]);await db.query("INSERT INTO lead(id,workspace_id,display_name) VALUES ($1,$2,'private lead')",[lead,ws]);});
 afterAll(async()=>{await db?.onModuleDestroy();});
 it('exports consistent lead scope and appends payload-free export audit',async()=>{
  expect(await store.exportLead(other,lead,'admin')).toBeUndefined();
  const artifact=await store.exportLead(ws,lead,'admin');expect(artifact?.records.lead[0].display_name).toBe('private lead');expect(artifact?.synthetic).toBe('unknown');
  const audit=(await db.query<{new_value:unknown}>("SELECT new_value FROM audit_record WHERE workspace_id=$1 AND event_type='LEAD_DATA_EXPORTED'",[ws])).rows;
  expect(audit).toHaveLength(1);expect(JSON.stringify(audit)).not.toContain('private lead');
 });
 it('refuses to deliver artifact when required audit cannot append',async()=>{
  await db.query(`CREATE FUNCTION fail_export_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='LEAD_DATA_EXPORTED' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER fail_export_test BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION fail_export_test()');
  try{await expect(store.exportLead(ws,lead,'admin')).rejects.toThrow('audit unavailable');}finally{await db.query('DROP TRIGGER fail_export_test ON audit_record');await db.query('DROP FUNCTION fail_export_test()');}
 });
 it('refuses truncation rather than silently returning incomplete data',async()=>{
  await db.query("INSERT INTO assertion_envelope(workspace_id,subject_type,subject_id,event_type,value,acquisition_mode,source_actor,created_by) SELECT $1,'lead',$2,'x','value','claimed','test','test' FROM generate_series(1,1001)",[ws,lead]);
  await expect(store.exportLead(ws,lead,'admin')).rejects.toMatchObject({code:'EXPORT_TOO_LARGE',status:413});
 });
});
