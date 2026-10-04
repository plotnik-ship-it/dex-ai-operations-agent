import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DemoPlanner,runReminderAgent} from '../src/agent.js';
import type {OperationsStore,RunCompletion} from '../src/store.js';
import type {ContractSource} from '../src/contracts.js';
const cases=JSON.parse(await readFile('fixtures/adversarial-contracts.json','utf8')) as {name:string;expected:string;sources:ContractSource[];ranked?:ContractSource[]}[];
const identity={userId:'agent-a',agencyId:'agency-a'},embedder={embed:async()=>Array(384).fill(0.1)};
for(const item of cases)test('untrusted evidence: '+item.name,async()=>{
 const saved:any[]=[];
 const store:OperationsStore={attention:async()=>[{id:'b',groupId:'g',balanceMinor:'150000',currency:'USD',missingDocuments:['passport_copy']}],contractSources:async()=>item.sources,searchSources:async()=>item.ranked??item.sources,saveDraft:async(_i,_g,p)=>{saved.push(p);return{id:'draft',expiresAt:'2026-12-01T00:00:00Z'};}};
 const result=await runReminderAgent(store,embedder,new DemoPlanner(),identity,'g','Prepare reminders for review');
 assert.equal(result.status,item.expected);assert.equal(result.deliveryEnabled,false);assert.equal(saved.length,1);
 if(item.expected==='needs_review')assert.deepEqual(result.drafts,[]);
 else{assert.equal(result.drafts[0]?.deliveryDestination,'demo@example.test');assert.match(result.drafts[0]!.body,/2026-11-15/);assert.ok(!result.drafts[0]!.body.includes('attacker'));assert.ok(!result.drafts[0]!.body.includes('2027-01-01'));}
});
test('model interruption after retrieval records failure and never saves a draft',async()=>{
 let saved=0;let completion:RunCompletion|undefined;
 const store:OperationsStore={attention:async()=>[],contractSources:async()=>cases[3]!.sources,searchSources:async()=>cases[3]!.sources,saveDraft:async()=>{saved++;return null;},startRun:async()=>true,finishRun:async(_i,_g,_r,r)=>{completion=r;return true;}};
 const demo=new DemoPlanner();
 await assert.rejects(runReminderAgent(store,embedder,{mode:'fault-injection',next:async input=>{if(input.completed.length===2)throw Error('Simulated provider interruption');return demo.next(input);}},identity,'g','prepare'),/interruption/);
 assert.equal(saved,0);assert.equal(completion?.status,'failed');assert.equal(completion?.events.length,2);assert.equal(completion?.draftId,null);
});
