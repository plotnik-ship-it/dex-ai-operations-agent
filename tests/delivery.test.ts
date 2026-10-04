import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {ApprovalService,payloadHash} from '../src/approval.js';
import {MailpitTransport,processNextJob} from '../src/delivery.js';
import {PostgresOperationsStore} from '../src/store.js';
import {resolveDeadline} from '../src/contracts.js';
import {buildApp} from '../src/app.js';
import {demoAuthenticator} from '../src/auth.js';
import {runReminderAgent,DemoPlanner} from '../src/agent.js';
import {mkdir,writeFile} from 'node:fs/promises';
test('approval, stale state, durable delivery, concurrent claims and uncertain outcomes',{skip:process.env.DELIVERY_EVAL!=='true'},async(t)=>{
 assert.ok(process.env.TEST_DATABASE_URL);assert.ok(process.env.INDEX_DATABASE_URL);assert.ok(process.env.WORKER_DATABASE_URL);
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL});
 const admin=new Pool({connectionString:process.env.INDEX_DATABASE_URL});
 const queue=new Pool({connectionString:process.env.WORKER_DATABASE_URL});
 const suffix=randomUUID(),agency='test-'+suffix,user='user-'+suffix,group='group-'+suffix;
 const identity={userId:user,agencyId:agency};
 const store=new PostgresOperationsStore(pool),approvals=new ApprovalService(pool);
 const token='delivery-integration-demo-token-123';
 const app=buildApp(store,demoAuthenticator([{...identity,token}]),approvals);
 const headers={authorization:'Bearer '+token};
 try {
  assert.equal((await admin.query("SELECT id FROM delivery_jobs WHERE status IN ('queued','sending')")).rowCount,0,'Stop the worker and finish outstanding demo jobs before isolated delivery tests');
  await admin.query('INSERT INTO agencies VALUES($1,$2)',[agency,'Delivery test']);
  await admin.query("INSERT INTO memberships VALUES($1,$2,'owner',true)",[user,agency]);
  await admin.query('INSERT INTO groups VALUES($1,$2,$3)',[group,agency,'Delivery test']);
  await admin.query("INSERT INTO bookings VALUES('booking-test',$1,$2,200000,50000,'USD',ARRAY['passport_copy'],'active')",[agency,group]);
  await admin.query("INSERT INTO contracts VALUES($1,'contract-test',$2,'Test contract','1',true)",[agency,group]);
  await admin.query("INSERT INTO contract_chunks(agency_id,id,contract_id,page,section,excerpt) VALUES($1,'p','contract-test',1,'Section 4 — Final payment','The remaining booking balance must be paid by November 15, 2026.'),($1,'d','contract-test',1,'Section 5 — Required documents','Passport copies must be submitted by November 10, 2026.')",[agency]);
  const make=async()=>{
   const sources=(await store.contractSources(identity,group))!;
   const payload={status:'pending_review',drafts:[{bookingId:'booking-test',deliveryDestination:'demo@example.test',subject:'Dex delivery test '+suffix,body:'Synthetic reminder approved by the integration test. USD 1500.00 due 2026-11-15; passport copy due 2026-11-10.',balanceMinor:'150000',currency:'USD',missingDocuments:['passport_copy']}],deadlines:[resolveDeadline(sources,'payment'),resolveDeadline(sources,'documents')]};
   const saved=(await store.saveDraft(identity,group,payload))!;
   return {id:saved.id,hash:payloadHash(payload)};
  };
  const first=await make();
  await assert.rejects(approvals.forDelivery(identity,first.id),/Approval required/);
  await assert.rejects(approvals.review({userId:'owner-b',agencyId:'agency-b'},first.id),/unavailable/);
  await assert.rejects(approvals.approve(identity,first.id,'0'.repeat(64)),/changed/);
  const rejected=await app.inject({method:'POST',url:'/drafts/'+first.id+'/approve',headers,payload:{reviewHash:first.hash,confirm:false}});
  assert.equal(rejected.statusCode,400);
  const review=await app.inject({url:'/drafts/'+first.id,headers});assert.equal(review.json().reviewHash,first.hash);
  const approve=()=>app.inject({method:'POST',url:'/drafts/'+first.id+'/approve',headers,payload:{reviewHash:first.hash,confirm:true}});
  const [one,two]=await Promise.all([approve(),approve()]);
  assert.equal(one.statusCode,200);assert.equal(two.statusCode,200);assert.equal(one.json().jobId,two.json().jobId);
  let sent=0;
  const transport={send:async()=>{sent++;}};
  await Promise.all([processNextJob(queue,approvals,transport),processNextJob(queue,approvals,transport)]);
  assert.equal(sent,1);
  assert.equal((await approvals.review(identity,first.id)).delivery.status,'sent');
  const expired=await make();await admin.query("UPDATE reminder_drafts SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
  await assert.rejects(approvals.approve(identity,expired.id,expired.hash),/expired/);
  const stale=await make();await approvals.approve(identity,stale.id,stale.hash);
  await admin.query("UPDATE bookings SET paid_minor=200000 WHERE agency_id=$1",[agency]);
  assert.equal((await processNextJob(queue,approvals,transport))?.status,'blocked');assert.equal(sent,1);
  await admin.query('UPDATE bookings SET paid_minor=50000 WHERE agency_id=$1',[agency]);
  const revoked=await make();await approvals.approve(identity,revoked.id,revoked.hash);
  await admin.query('UPDATE memberships SET active=false WHERE agency_id=$1',[agency]);
  assert.equal((await processNextJob(queue,approvals,transport))?.status,'blocked');assert.equal(sent,1);
  await admin.query('UPDATE memberships SET active=true WHERE agency_id=$1',[agency]);
  const uncertain=await make();await approvals.approve(identity,uncertain.id,uncertain.hash);
  assert.equal((await processNextJob(queue,approvals,{send:async()=>{throw Error('Simulated SMTP timeout');}}))?.status,'uncertain');
  assert.equal(await processNextJob(queue,approvals,transport),null);
  const changed=await make();await approvals.approve(identity,changed.id,changed.hash);
  await admin.query("UPDATE contract_chunks SET excerpt='The remaining booking balance must be paid by November 16, 2026.' WHERE agency_id=$1 AND id='p'",[agency]);
  assert.equal((await processNextJob(queue,approvals,transport))?.status,'blocked');
  await admin.query("UPDATE contract_chunks SET excerpt='The remaining booking balance must be paid by November 15, 2026.' WHERE agency_id=$1 AND id='p'",[agency]);
  const tampered=await make();await approvals.approve(identity,tampered.id,tampered.hash);
  await admin.query("UPDATE reminder_drafts SET payload=jsonb_set(payload,'{drafts,0,body}','\"Changed after approval\"'::jsonb) WHERE id=$1",[tampered.id]);
  assert.equal((await processNextJob(queue,approvals,transport))?.status,'blocked');
  const crashed=await make();const crashedJob=await approvals.approve(identity,crashed.id,crashed.hash);
  await admin.query("UPDATE delivery_jobs SET status='sending',started_at=now()-interval '6 minutes' WHERE id=$1",[crashedJob.jobId]);
  assert.equal(await processNextJob(queue,approvals,transport),null);
  assert.equal((await approvals.review(identity,crashed.id)).delivery.status,'uncertain');
  for(const scenario of [
   {name:'documents received after approval',change:"UPDATE bookings SET missing_documents=ARRAY[]::text[] WHERE agency_id=$1",restore:"UPDATE bookings SET missing_documents=ARRAY['passport_copy'] WHERE agency_id=$1"},
   {name:'reservation cancelled after approval',change:"UPDATE bookings SET status='cancelled' WHERE agency_id=$1",restore:"UPDATE bookings SET status='active' WHERE agency_id=$1"}
  ])await t.test(scenario.name,async()=>{
   const draft=await make();await approvals.approve(identity,draft.id,draft.hash);const before=sent;
   try{await admin.query(scenario.change,[agency]);assert.equal((await processNextJob(queue,approvals,transport))?.status,'blocked');assert.equal(sent,before);}
   finally{await admin.query(scenario.restore,[agency]);}
  });
  await t.test('approval expires while queued',async()=>{
   const draft=await make();await approvals.approve(identity,draft.id,draft.hash);const before=sent;
   await admin.query("UPDATE reminder_drafts SET expires_at=now()-interval '1 second' WHERE id=$1",[draft.id]);
   assert.equal((await processNextJob(queue,approvals,transport))?.status,'blocked');assert.equal(sent,before);
  });
  await t.test('SMTP acceptance followed by a lost response is never automatically retried',async()=>{
   const draft=await make();const approved=await approvals.approve(identity,draft.id,draft.hash);let accepted=0;
   assert.equal((await processNextJob(queue,approvals,{send:async()=>{accepted++;throw Error('Response lost after simulated SMTP acceptance');}}))?.status,'uncertain');
   const again=await approvals.approve(identity,draft.id,draft.hash);assert.equal(again.jobId,approved.jobId);assert.equal(again.status,'uncertain');
   assert.equal(await processNextJob(queue,approvals,transport),null);assert.equal(accepted,1);
  });
  const actual=await make();await approvals.approve(identity,actual.id,actual.hash);
  assert.equal((await processNextJob(queue,approvals,new MailpitTransport()))?.status,'sent');
  const inbox=await fetch('http://127.0.0.1:8025/api/v1/messages').then(r=>r.json()) as any;
  assert.ok(inbox.messages.some((m:any)=>m.Subject==='Dex delivery test '+suffix));
  await t.test('persistent trace connects a real PostgreSQL run to approved Mailpit delivery',async()=>{
   const run=await runReminderAgent({startRun:store.startRun.bind(store),finishRun:store.finishRun.bind(store),appendTrace:store.appendTrace.bind(store),attention:store.attention.bind(store),contractSources:store.contractSources.bind(store),searchSources:async(i,g)=>store.contractSources(i,g),saveDraft:store.saveDraft.bind(store)},{embed:async()=>Array(384).fill(0.1)},new DemoPlanner(),identity,group,'Prepare a synthetic reminder for human review');
   const review=await approvals.review(identity,run.draftId!);
   const job=await approvals.approve(identity,run.draftId!,review.reviewHash);
   assert.equal((await processNextJob(queue,approvals,new MailpitTransport()))?.status,'sent');
   const trace:any=await store.getTrace(identity,group,run.traceId);
   assert.equal(trace.delivery.id,job.jobId);assert.equal(trace.delivery.status,'sent');
   for(const type of ['user_request','model_decision','tool_selected','permission_check','tool_result','final_answer','approval_confirmed','delivery_claimed','delivery_attempt','delivery_finished'])assert.ok(trace.events.some((event:any)=>event.type===type),type);
   assert.equal(await store.getTrace({userId:'owner-b',agencyId:'agency-b'},group,run.traceId),null);
   const response=await app.inject({url:'/groups/'+group+'/runs/'+run.traceId+'/trace',headers});assert.equal(response.statusCode,200);assert.equal(response.json().traceId,run.traceId);
   await mkdir('docs/evals',{recursive:true});
   await writeFile('docs/evals/delivery-trace-example.json',JSON.stringify({scope:'Real local PostgreSQL, approvals, queue and Mailpit; scripted planner and controlled retrieval. Test agency removed after export.',...trace},null,2)+'\n');
  });
 }finally {
  await app.close();
  // Remove only this test's isolated agency rows; keep the Mailpit message as evidence.
  for(const table of ['delivery_jobs','reminder_approvals','agent_runs','reminder_drafts','contract_chunks','contracts','bookings','group_assignments','groups','memberships'])await admin.query('DELETE FROM '+table+' WHERE agency_id=$1',[agency]);
  await admin.query('DELETE FROM agencies WHERE id=$1',[agency]);
  await pool.end();await admin.end();await queue.end();
 }
});
