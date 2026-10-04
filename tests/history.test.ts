import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {PostgresOperationsStore,type OperationsStore,type RunCompletion} from '../src/store.js';
import {runReminderAgent} from '../src/agent.js';
import {buildApp} from '../src/app.js';
const identity={userId:'agent-a',agencyId:'agency-a'};
const embedder={embed:async()=>{throw Error('Must not embed');}};
test('history records refusals and sanitized failures including model usage',async()=>{
 const records:RunCompletion[]=[];
 const store:OperationsStore={attention:async()=>[],contractSources:async()=>[],searchSources:async()=>[],saveDraft:async()=>{throw Error('Must not draft');},startRun:async()=>true,finishRun:async(_i,_g,_r,result)=>{records.push(result);return true;}};
 const refused=await runReminderAgent(store,embedder,{mode:'test',next:async()=>({name:'stop',arguments:{reason:'out_of_scope'}}),metrics:()=>({calls:1})},identity,'group-a','unrelated');
 assert.equal(refused.historyRecorded,true);assert.equal(records[0]?.status,'no_action');assert.deepEqual(records[0]?.modelUsage,{calls:1});assert.equal(records[0]?.draftId,null);
 await assert.rejects(runReminderAgent(store,embedder,{mode:'test',next:async()=>{throw Error('secret provider payload');}},identity,'group-a','test'),/secret provider payload/);
 assert.equal(records[1]?.status,'failed');assert.equal(records[1]?.errorCode,'run_failed');assert.ok(!JSON.stringify(records).includes('secret'));
 let called=false;await assert.rejects(runReminderAgent({...store,startRun:async()=>false},embedder,{mode:'test',next:async()=>{called=true;}},identity,'group-b','test'),/Group unavailable/);assert.equal(called,false);
});
test('history API authenticates and enforces group scope',async()=>{
 const app=buildApp({attention:async()=>[],listRuns:async(_i,g)=>g==='group-a'?[]:null},h=>h==='Bearer test'?identity:null);
 try{assert.equal((await app.inject('/groups/group-a/runs')).statusCode,401);
 assert.equal((await app.inject({url:'/groups/group-b/runs',headers:{authorization:'Bearer test'}})).statusCode,404);
 const res=await app.inject({url:'/groups/group-a/runs',headers:{authorization:'Bearer test'}});assert.equal(res.statusCode,200);assert.deepEqual(res.json(),{runs:[]});
 }finally{await app.close();}
});
test('PostgreSQL run history isolates creators, tenants and revoked access',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:1});
 const store=new PostgresOperationsStore(pool),id=randomUUID();
 try{
 assert.equal(await store.startRun(identity,'group-b',randomUUID(),'test'),false);
 assert.equal(await store.startRun(identity,'group-a',id,'test'),true);
 const completion={status:'failed',durationMs:5,events:[],modelUsage:{calls:1},draftId:null,errorCode:'run_failed'};
 assert.equal(await store.finishRun({userId:'owner-a',agencyId:'agency-a'},'group-a',id,completion),false);
 assert.equal(await store.finishRun(identity,'group-a',id,completion),true);
 assert.equal(await store.finishRun(identity,'group-a',id,completion),false);
 const rows=await store.listRuns(identity,'group-a') as any[];assert.equal(rows.find(r=>r.id===id)?.status,'failed');assert.ok(rows.length<=20);
 assert.ok(!(await store.listRuns({userId:'owner-a',agencyId:'agency-a'},'group-a') as any[]).some(r=>r.id===id));
 assert.equal(await store.listRuns({userId:'owner-b',agencyId:'agency-b'},'group-a'),null);
 assert.equal(await store.listRuns({userId:'revoked-a',agencyId:'agency-a'},'group-a'),null);
 assert.equal((await pool.query('SELECT id FROM agent_runs WHERE id=$1',[id])).rowCount,0);
 }finally{
 await pool.end();
 if(process.env.INDEX_DATABASE_URL){const cleanup=new Pool({connectionString:process.env.INDEX_DATABASE_URL});try{await cleanup.query('DELETE FROM agent_runs WHERE id=$1',[id]);}finally{await cleanup.end();}}
 }
});
