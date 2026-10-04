import type {Pool} from 'pg';
import {PostgresOperationsStore} from '../src/store.js';
import {buildApp} from '../src/app.js';
import {demoAuthenticator} from '../src/auth.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite-pgvector';
import {resolveDeadline} from '../src/contracts.js';
import type {ContractSource} from '../src/contracts.js';
test('PostgreSQL WASM engine: migrations, RLS, citations, revocation and context cleanup',async()=>{
 const db=new PGlite({extensions:{vector}});
 try {
  for(const file of ['001-foundation.sql','002-authorization.sql','003-contract-evidence.sql','004-drafts.sql','005-approved-delivery.sql','006-run-history.sql','007-tracing.sql'])await db.exec(await readFile('database/'+file,'utf8'));
  await db.exec('SET ROLE dex_runtime');
  // Single-connection test bridge: executes production store SQL in PGlite.
  // Does not emulate network behavior or a real pg connection pool.
  const bridge={connect:async()=>({
   query:async(text:string,values?:unknown[])=>{const result=await db.query(text,values);return {...result,rowCount:result.rows.length};},
   release:()=>{}
  })} as unknown as Pool;
  const store=new PostgresOperationsStore(bridge);
  const token='fixture-engine-demo-token-at-least-24';
  const app=buildApp(store,demoAuthenticator([{userId:'agent-a',agencyId:'agency-a',token}]));
  try {
   const headers={authorization:'Bearer '+token};
   const attention=await app.inject({url:'/groups/group-a/attention',headers});
   assert.equal(attention.statusCode,200);
   assert.deepEqual(attention.json().findings.map((f:any)=>f.id),['booking-a1']);
   assert.equal(attention.json().findings[0].balanceMinor,'150000');
   const deadline=await app.inject({url:'/groups/group-a/deadlines',headers});
   assert.equal(deadline.statusCode,200);
   assert.deepEqual(deadline.json().deadlines.map((d:any)=>d.date),['2026-11-15','2026-11-10']);
   assert.equal(deadline.json().deadlines[0].sources[0].id,'payment-a');
   for(const group of ['group-b','group-a-private'])assert.equal((await app.inject({url:'/groups/'+group+'/deadlines',headers})).statusCode,404);
   assert.equal((await app.inject('/groups/group-a/deadlines')).statusCode,401);
  }finally{await app.close();}
  const read=async(user:string,agency:string,table:string)=>{
   await db.exec('BEGIN');
   try {
    await db.query("SELECT set_config('dex.user_id',$1,true),set_config('dex.agency_id',$2,true)",[user,agency]);
    // table is a test-owned literal, never user input.
    return (await db.query('SELECT id FROM '+table+' ORDER BY id')).rows.map((r:any)=>r.id);
   }finally{await db.exec('ROLLBACK');}
  };
  assert.deepEqual(await read('agent-a','agency-a','groups'),['group-a']);
  assert.deepEqual(await read('owner-a','agency-a','groups'),['group-a','group-a-private']);
  assert.deepEqual(await read('agent-a','agency-b','bookings'),[]);
  assert.deepEqual(await read('revoked-a','agency-a','bookings'),[]);
  assert.deepEqual(await read('owner-b','agency-b','contract_chunks'),['payment-b']);
  assert.deepEqual(await read('agent-a','agency-a','contract_chunks'),['documents-a','payment-a']);
  assert.equal((await db.query('SELECT * FROM bookings')).rows.length,0);
  await db.exec('BEGIN');
  await db.query("SELECT set_config('dex.user_id','agent-a',true),set_config('dex.agency_id','agency-a',true)");
  assert.deepEqual((await db.query("SELECT id FROM bookings WHERE status='active' AND total_minor>paid_minor AND cardinality(missing_documents)>0")).rows,[{id:'booking-a1'}]);
  const sources=await db.query<ContractSource>('SELECT ch.id,c.id AS "contractId",c.title,c.version,ch.page,ch.section,ch.excerpt FROM contracts c JOIN contract_chunks ch ON ch.agency_id=c.agency_id AND ch.contract_id=c.id');
  assert.equal(resolveDeadline(sources.rows,'payment').date,'2026-11-15');
  assert.equal(resolveDeadline(sources.rows,'documents').date,'2026-11-10');
  await db.exec('ROLLBACK');
  await assert.rejects(db.exec("UPDATE bookings SET paid_minor=0"));
  await db.exec('RESET ROLE');
  await db.exec("UPDATE memberships SET active=false WHERE user_id='agent-a'");
  await db.exec('SET ROLE dex_runtime');
  assert.deepEqual(await read('agent-a','agency-a','contract_chunks'),[]);
 }finally{await db.close();}
});
