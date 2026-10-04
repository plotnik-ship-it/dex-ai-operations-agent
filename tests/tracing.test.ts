import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite-pgvector';
import type {Pool} from 'pg';
import {PostgresOperationsStore} from '../src/store.js';
import {DemoPlanner,runReminderAgent} from '../src/agent.js';
import {ApprovalService} from '../src/approval.js';
import {processNextJob} from '../src/delivery.js';
import {buildApp} from '../src/app.js';
import {traceEvent} from '../src/tracing.js';
test('trace reconstructs request → tools → approved queue → delivery with immutable scoped evidence',async()=>{
 const db=new PGlite({extensions:{vector}});
 try{
 for(const file of ['001-foundation.sql','002-authorization.sql','003-contract-evidence.sql','004-drafts.sql','005-approved-delivery.sql','006-run-history.sql','007-tracing.sql'])await db.exec(await readFile('database/'+file,'utf8'));
 const query=async(text:string,values?:unknown[])=>{const result=await db.query(text,values);return {...result,rowCount:result.rows.length};};
 const pool={connect:async()=>({query,release:()=>{}})} as unknown as Pool;
 const queue={query:async(text:string,values?:unknown[])=>{await db.exec('SET ROLE dex_worker');try{return await query(text,values);}finally{await db.exec('SET ROLE dex_runtime');}}} as unknown as Pool;
 await db.exec('SET ROLE dex_runtime');
 const store=new PostgresOperationsStore(pool),approval=new ApprovalService(pool),identity={userId:'agent-a',agencyId:'agency-a'};
 const planner=Object.assign(new DemoPlanner(),{metrics:()=>({model:'fixture',inputTokens:120,outputTokens:15,estimatedProviderCostUsd:0})});
 const run=await runReminderAgent({startRun:store.startRun.bind(store),finishRun:store.finishRun.bind(store),appendTrace:store.appendTrace.bind(store),attention:store.attention.bind(store),searchSources:async(i,g)=>store.contractSources(i,g),contractSources:store.contractSources.bind(store),saveDraft:store.saveDraft.bind(store)},{embed:async()=>Array(384).fill(0.1)},planner,identity,'group-a','Prepare reminder for traveler@example.test; Bearer privatecredential');
 assert.equal(run.traceId,run.runId);
 const reviewed=await approval.review(identity,run.draftId!);
 await assert.rejects(approval.approve(identity,run.draftId!,'0'.repeat(64)));
 const approved=await approval.approve(identity,run.draftId!,reviewed.reviewHash);
 const duplicate=await approval.approve(identity,run.draftId!,reviewed.reviewHash);assert.equal(approved.jobId,duplicate.jobId);
 let sends=0;
 assert.equal((await processNextJob(queue,approval,{send:async()=>{sends++;}}))?.status,'sent');
 assert.equal(sends,1);
 const trace:any=await store.getTrace(identity,'group-a',run.runId);
 assert.equal(trace.delivery.id,approved.jobId);assert.equal(trace.delivery.status,'sent');
 for(const type of ['user_request','model_started','model_decision','tool_selected','permission_check','tool_result','final_answer','approval_denied','approval_confirmed','approval_duplicate','delivery_claimed','delivery_attempt','delivery_result','delivery_finished'])assert.ok(trace.events.some((e:any)=>e.type===type),type);
 assert.equal(trace.events.filter((e:any)=>e.type==='model_decision').length,3);
 assert.deepEqual(trace.events.filter((e:any)=>e.type==='tool_selected').map((e:any)=>e.data.tool),['list_bookings_requiring_attention','search_contract_sources','prepare_reminder_draft']);
 assert.equal(trace.events.find((e:any)=>e.type==='final_answer').data.modelUsage.inputTokens,120);
 assert.ok(trace.events.every((e:any)=>e.id && e.spanId && e.timestamp && (e.durationMs===null||e.durationMs>=0)));
 assert.ok(!JSON.stringify(trace).includes('privatecredential'));assert.ok(!JSON.stringify(trace.events).includes('traveler@example.test'));
 assert.ok(trace.events.every((e:any,i:number)=>i===0||BigInt(e.sequence)>BigInt(trace.events[i-1].sequence)));
 await assert.rejects(query('UPDATE trace_events SET event_type=$1',['tampered']),/permission denied/);
 await assert.rejects(query('DELETE FROM trace_events'),/permission denied/);
 assert.equal(await store.appendTrace({userId:'owner-a',agencyId:'agency-a'},'group-a',run.runId,traceEvent('forged',{},randomUUID())),false);
 const app=buildApp(store,h=>h==='Bearer fixture'?identity:null);
 try{
 assert.equal((await app.inject('/groups/group-a/runs/'+run.runId+'/trace')).statusCode,401);
 assert.equal((await app.inject({url:'/groups/group-a/runs/'+run.runId+'/trace',headers:{authorization:'Bearer fixture'}})).json().traceId,run.runId);
 assert.equal((await app.inject({url:'/groups/group-a/runs/'+randomUUID()+'/trace',headers:{authorization:'Bearer fixture'}})).statusCode,404);
 assert.equal((await app.inject({url:'/groups/group-b/runs/'+run.runId+'/trace',headers:{authorization:'Bearer fixture'}})).statusCode,404);
 }finally{await app.close();}
 // Telemetry failure after SMTP must not repeat delivery or mark a confirmed send uncertain.
 const next=await runReminderAgent({attention:store.attention.bind(store),contractSources:store.contractSources.bind(store),searchSources:async(i,g)=>store.contractSources(i,g),saveDraft:store.saveDraft.bind(store)},{embed:async()=>Array(384).fill(0.1)},new DemoPlanner(),identity,'group-a','Prepare another reminder');
 const nextReview=await approval.review(identity,next.draftId!);await approval.approve(identity,next.draftId!,nextReview.reviewHash);
 approval.traceDelivery=async()=>false;
 assert.equal((await processNextJob(queue,approval,{send:async()=>{sends++;}}))?.status,'sent');
 assert.equal(await processNextJob(queue,approval,{send:async()=>{sends++;}}),null);assert.equal(sends,2);
 // Losing group access also prevents further trace writes. Preserve the access denial.
 let subsequentTools=0;
 await assert.rejects(runReminderAgent({
  startRun:store.startRun.bind(store),finishRun:store.finishRun.bind(store),appendTrace:store.appendTrace.bind(store),
  attention:async(i,g)=>{const result=await store.attention(i,g);await db.exec("RESET ROLE; UPDATE memberships SET active=false WHERE user_id='agent-a'; SET ROLE dex_runtime");return result;},
  contractSources:async()=>{subsequentTools++;return [];},searchSources:async()=>{subsequentTools++;return [];},
  saveDraft:async()=>{subsequentTools++;return null;}
 },{embed:async()=>{subsequentTools++;return Array(384).fill(0.1);}},new DemoPlanner(),identity,'group-a','Prepare reminder'),/Group unavailable/);
 assert.equal(subsequentTools,0);
 }finally{await db.close();}
});
