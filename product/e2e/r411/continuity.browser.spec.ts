import {expect,test,type Page} from '@playwright/test';
import {Pool} from 'pg';
test.describe.configure({mode:'serial'});
async function login(page:Page,account:string){await page.goto('operator');await page.locator('#signin').click();await expect(page).toHaveURL(/3431\/authorize/);await page.getByLabel('Account').selectOption(account);await page.getByRole('button',{name:'Continue'}).click();await expect(page.locator('#session-status')).toHaveText('Signed in.');}
async function api(page:Page,path:string,body?:unknown){return page.evaluate(async({path,body})=>{
 const session=await(await fetch('/v1/auth/session')).json();const r=await fetch('/v1/source-integrations/'+path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify(body)});
 return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};
},{path,body});}
async function submit(page:Page){await page.locator('#submit-command').click();await expect(page.locator('#command-dialog')).not.toBeVisible();}
test('signed synthetic HTTP intake and explicit UI association preserve origin, access and history',async({page,browser,request})=>{
 const db=new Pool({connectionString:process.env.QA_DATABASE_URL});const contexts=[];
 try{
  await login(page,'admin');
  // Source delivery uses real signed HTTP; subsequent association is performed through the UI.
  const connection=await api(page,'connections',{provider:'pancake',route:'pancake-synthetic',pageId:'synthetic-page-1'});expect(connection.status).toBe(201);
  const cid=connection.body.id;const example=(await api(page,`connections/${cid}/example`)).body.fixture;
  const deliver=async(receiptId:string,messageId:string,name:string)=>api(page,`connections/${cid}/observations`,{fixture:{...example,receiptId,displayName:name,originalMeta:{...example.originalMeta,messageId}},claimResponsibility:true});
  const target=await deliver('qa-target','qa-target-message','QA target');const origin=await deliver('qa-origin','qa-origin-message','QA origin');
  expect(target.status).toBe(201);expect(origin.status).toBe(201);expect(target.body.leadId).not.toBe(origin.body.leadId);
  const before=(await db.query('SELECT to_jsonb(r) data FROM source_receipt r ORDER BY id')).rows;
  const replay=await deliver('qa-origin','qa-origin-message','QA origin');expect(replay.body.disposition).toBe('receipt_duplicate');
  const conflict=await deliver('qa-origin','changed-message','QA origin');expect(conflict.status).toBe(409);
  expect((await api(page,`connections/${cid}/observations`,{fixture:example,claimResponsibility:true,verified:true})).status).toBe(400);
  expect((await api(page,`connections/${cid}/observations`,{fixture:{...example,payloadHash:'forbidden-body-digest'},claimResponsibility:true})).status).toBe(400);
  expect((await api(page,`leads/${target.body.leadId}/source-links`,{connectionId:cid,receiptId:origin.body.receiptId,evidenceEnvelopeId:target.body.envelopeId,expectedVersion:0,idempotencyKey:'wrong-envelope',action:'link',reason:'Wrong evidence must fail'})).status).toBe(422);
  await page.locator('#refresh').click();await page.locator('.queue-item').filter({hasText:'QA target'}).click();
  const association=async(action:string,version:number)=>{
   await page.locator('#link-source-receipt').click();await page.locator('#link-connection').fill(cid);await page.locator('#link-receipt').fill(origin.body.receiptId);
   await page.locator('#link-envelope').fill(origin.body.envelopeId);await page.locator('#link-version').fill(String(version));await page.locator('#link-action').selectOption(action);await page.locator('#reason').fill('Explicit fabricated context association');
   const response=page.waitForResponse(r=>r.url().endsWith('/source-links')&&r.request().method()==='POST');await submit(page);expect((await response).status()).toBe(201);
  };
  await association('link',0);await page.locator('#linked-source-evidence').click();await expect(page.locator('#read-view')).toContainText('no Customer or Lead identity merge');await expect(page.locator('#read-view')).toContainText('UNVERIFIED');
  expect((await api(page,`leads/${target.body.leadId}/linked-evidence`)).body.items).toHaveLength(1);
  await association('unlink',1);expect((await api(page,`leads/${target.body.leadId}/linked-evidence`)).body.items).toEqual([]);
  await association('link',2);expect((await api(page,`leads/${target.body.leadId}/source-links`)).body.items).toHaveLength(3);
  expect((await db.query('SELECT to_jsonb(r) data FROM source_receipt r ORDER BY id')).rows).toEqual(before);
  expect((await db.query('SELECT count(*)::int n FROM lead')).rows[0].n).toBe(2);
  const own=await api(page,`leads/${target.body.leadId}/evidence`);expect(own.body.items[0].trust).toMatchObject({verification:'UNVERIFIED',nativeMapping:'USER_ASSERTED_CANDIDATE',providerAttestation:'NOT_AVAILABLE'});expect(own.cache).toBe('no-store');
  expect((await request.get(`source-integrations/leads/${target.body.leadId}/source-links`)).status()).toBe(401);
  expect(await page.evaluate(async id=>(await fetch('/v1/source-integrations/leads/'+id+'/source-links',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,target.body.leadId)).toBe(403);
  const recipientContext=await browser.newContext();contexts.push(recipientContext);const recipient=await recipientContext.newPage();await login(recipient,'recipient');
  const recipientId=await recipient.evaluate(async()=>(await(await fetch('/v1/auth/session')).json()).context.userId);
  // Test-only SQL changes ownership to isolate target-only access; no human journey claim for this setup.
  await db.query('UPDATE lead SET owner_user_id=$1 WHERE id=$2',[recipientId,target.body.leadId]);
  expect((await api(recipient,`leads/${target.body.leadId}/linked-evidence`)).body.items).toEqual([]);
  expect((await api(recipient,`leads/${origin.body.leadId}/evidence`)).status).toBe(403);
  expect((await api(recipient,`leads/${target.body.leadId}/source-links`)).body.items).toEqual([]);
  const foreignContext=await browser.newContext();contexts.push(foreignContext);const foreign=await foreignContext.newPage();await login(foreign,'foreign');expect((await api(foreign,`leads/${target.body.leadId}/linked-evidence`)).status).toBe(404);
  const denied=await api(page,`leads/${target.body.leadId}/source-links`,{connectionId:cid,receiptId:origin.body.receiptId,evidenceEnvelopeId:origin.body.envelopeId,expectedVersion:3,idempotencyKey:'ownership-refusal',action:'unlink',reason:'Not current target owner'});expect(denied.status).toBe(403);
  expect((await request.post('http://127.0.0.1:3432/revoke-recipient',{headers:{'x-qa-control':process.env.QA_CONTROL_SECRET!}})).ok()).toBe(true);
  expect((await api(recipient,`leads/${target.body.leadId}/linked-evidence`)).status).toBe(403);
 }finally{for(const context of contexts)await context.close();await db.end();}
});
test('actual PostgreSQL evidence exceeds 100 records and late source responses cannot replace selected Lead',async({page,request})=>{
 await login(page,'admin');
 // Explicit test control seeds fabricated event versions using the production store, not UI business creation.
 expect((await request.post('http://127.0.0.1:3432/seed-paging',{headers:{'x-qa-control':process.env.QA_CONTROL_SECRET!}})).ok()).toBe(true);
 const db=new Pool({connectionString:process.env.QA_DATABASE_URL});
 try{
  const origin=(await db.query("SELECT id FROM lead WHERE display_name='QA origin'")).rows[0].id;
  const target=(await db.query("SELECT id FROM lead WHERE display_name='QA target'")).rows[0].id;
  const ids=new Set<string>();let cursor:string|null=null;
  do{const response=await api(page,`leads/${origin}/evidence?limit=17`+(cursor?'&cursor='+encodeURIComponent(cursor):''));expect(response.status).toBe(200);expect(response.body.items.length).toBeLessThanOrEqual(17);
   for(const item of response.body.items){expect(ids.has(item.receipt.receiptId)).toBe(false);ids.add(item.receipt.receiptId);}cursor=response.body.nextCursor;
  }while(cursor);
  expect(ids.size).toBe(106);
  expect((await api(page,`leads/${origin}/evidence?limit=101`)).status).toBe(400);
  await page.locator('#refresh').click();await page.locator('.queue-item').filter({hasText:'QA origin'}).click();await page.locator('#source-evidence').click();await expect(page.locator('#read-view pre')).toHaveCount(20);
  await page.locator('#source-next-page').click();await expect(page.locator('#read-view pre')).toHaveCount(20);
  const old=(await api(page,`leads/${origin}/evidence`)).body;
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let entered!:()=>void;const seen=new Promise<void>(resolve=>{entered=resolve;});
  await page.route(`**/source-integrations/leads/${origin}/evidence`,async route=>{entered();await gate;await route.fulfill({json:old});});
  await page.locator('#source-evidence').click();await seen;await page.locator('.queue-item').filter({hasText:'QA target'}).click();await expect(page.locator('#context')).toContainText(target);
  release();await page.unrouteAll({behavior:'wait'});await expect(page.locator('#read-view pre')).toHaveCount(0);
  expect((await request.post('http://127.0.0.1:3432/restart',{headers:{'x-qa-control':process.env.QA_CONTROL_SECRET!}})).ok()).toBe(true);
  await login(page,'admin');expect((await api(page,`leads/${origin}/evidence?limit=100`)).body.items).toHaveLength(100);
  const cid=(await db.query("SELECT connection_id FROM source_receipt WHERE lead_id=$1 LIMIT 1",[origin])).rows[0].connection_id;
  expect((await api(page,`connections/${cid}/revoke`,{})).status).toBe(201);
  expect((await api(page,`connections/${cid}/observations`,{fixture:{},claimResponsibility:false})).body.code).toBe('CONNECTION_REVOKED');
 }finally{await db.end();}
});
