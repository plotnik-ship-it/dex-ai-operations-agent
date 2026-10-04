import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DemoPlanner,runReminderAgent,type Planner} from '../src/agent.js';
import type {OperationsStore} from '../src/store.js';
import type {ContractSource} from '../src/contracts.js';
const identity={userId:'agent-a',agencyId:'agency-a'};
const sources:ContractSource[]=[{id:'p',contractId:'c',title:'Contract',version:'1',page:1,section:'Section 4 — Final payment',excerpt:'The remaining booking balance must be paid by November 15, 2026.'},{id:'d',contractId:'c',title:'Contract',version:'1',page:1,section:'Section 5 — Required documents',excerpt:'Passport copies must be submitted by November 10, 2026.'}];
function fixture(extra:Partial<OperationsStore>={}) {
 const saved:unknown[]=[];
 const store:OperationsStore={attention:async()=>[{id:'booking-a1',groupId:'group-a',balanceMinor:'150001',currency:'USD',missingDocuments:['passport_copy']}],contractSources:async()=>sources,searchSources:async()=>sources,saveDraft:async(_identity,_group,payload)=>{saved.push(payload);return{id:'draft-1',expiresAt:'2026-11-01T00:00:00Z'};},...extra};
 return {saved,store};
}
const embedder={embed:async()=>Array(384).fill(0.1)};
test('bounded tools prepare an exact-money draft with citations and no sending',async()=>{
 const {saved,store}=fixture();
 const result=await runReminderAgent(store,embedder,new DemoPlanner(),identity,'group-a','Prepare a reminder');
 assert.equal(result.status,'pending_review');assert.equal(result.deliveryEnabled,false);
 assert.match(result.drafts[0]!.body,/USD 1500.01/);assert.match(result.drafts[0]!.body,/2026-11-10/);
 assert.equal(result.deadlines[0]!.sources[0]!.id,'p');assert.equal(result.events.length,3);assert.equal(saved.length,1);
});
test('tool validation blocks unknown tools, tenant arguments, reordering and loops',async()=>{
 const {store}=fixture();
 for(const call of [{name:'send_email',arguments:{}},{name:'list_bookings_requiring_attention',arguments:{filter:'unpaid_balances_and_missing_documents',agencyId:'agency-b'}},{name:'prepare_reminder_draft',arguments:{delivery:'draft_only'}},{name:'list_bookings_requiring_attention',arguments:{filter:'unpaid_balances_and_missing_documents'}}]){
  const planner:Planner={mode:'adversarial-test',next:async()=>call};
  await assert.rejects(runReminderAgent(store,embedder,planner,identity,'group-a','test'));
 }
});
test('unauthorized group never reaches embedding or draft tools',async()=>{
 const {store,saved}=fixture({attention:async()=>null});
 await assert.rejects(runReminderAgent(store,{embed:async()=>{throw Error('Embedding must not run');}},new DemoPlanner(),identity,'group-b','test'),/Group unavailable/);
 assert.equal(saved.length,0);
});
test('conflict outside top-k blocks every reminder',async()=>{
 const {store}=fixture({searchSources:async()=>sources,contractSources:async()=>[...sources,{...sources[0]!,id:'conflict',excerpt:'The remaining booking balance must be paid by November 16, 2026.'}]});
 const result=await runReminderAgent(store,embedder,new DemoPlanner(),identity,'group-a','test');
 assert.equal(result.status,'needs_review');assert.deepEqual(result.drafts,[]);
});
