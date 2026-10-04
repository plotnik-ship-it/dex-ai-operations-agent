import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {LocalEmbedder} from '../src/embeddings.js';
import {PostgresOperationsStore} from '../src/store.js';
import {buildApp} from '../src/app.js';
import {demoAuthenticator} from '../src/auth.js';
test('local embeddings + pgvector + API draft + persisted RLS',{skip:process.env.SEMANTIC_EVAL!=='true'},async()=>{
 assert.ok(process.env.TEST_DATABASE_URL,'TEST_DATABASE_URL required');
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:1});
 const store=new PostgresOperationsStore(pool),embedder=new LocalEmbedder();
 const identity={userId:'agent-a',agencyId:'agency-a'};
 const token='semantic-demo-test-token-at-least-24';
 const app=buildApp(store,demoAuthenticator([{...identity,token}]));
 try {
  for(const [query,expected] of [['When do travelers need to settle the outstanding amount?','payment-a'],['What is the last day to supply passport scans?','documents-a']]) {
   const vector=await embedder.embed(query!);
   const hits=await store.searchSources(identity,'group-a',query!,vector);
   assert.equal(hits?.[0]?.id,expected);
   assert.equal(await store.searchSources(identity,'group-b',query!,vector),null);
  }
  const response=await app.inject({method:'POST',url:'/groups/group-a/reminder-runs',headers:{authorization:'Bearer '+token},payload:{request:'Prepare reminders'}});
  assert.equal(response.statusCode,200);
  const result=response.json();
  assert.equal(result.status,'pending_review');assert.equal(result.drafts.length,1);assert.equal(result.deliveryEnabled,false);
  assert.match(result.drafts[0].body,/USD 1500.00/);
  const client=await pool.connect();
  try {
   await client.query('BEGIN');
   await client.query("SELECT set_config('dex.user_id',$1,true),set_config('dex.agency_id',$2,true)",[identity.userId,identity.agencyId]);
   assert.equal((await client.query('SELECT id FROM reminder_drafts WHERE id=$1',[result.draftId])).rowCount,1);
   await client.query("SELECT set_config('dex.user_id','owner-b',true),set_config('dex.agency_id','agency-b',true)");
   assert.equal((await client.query('SELECT id FROM reminder_drafts WHERE id=$1',[result.draftId])).rowCount,0);
   await client.query('ROLLBACK');
  }finally{client.release();}
 }finally{await app.close();await pool.end();}
});
