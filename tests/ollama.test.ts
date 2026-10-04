import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OllamaPlanner} from '../src/ollama.js';
const input={request:'Prepare reminders',completed:[]};
const validCall={name:'list_bookings_requiring_attention',arguments:{filter:'unpaid_balances_and_missing_documents'}};
const result={model:'qwen3:4b',message:{content:JSON.stringify(validCall)},prompt_eval_count:100,eval_count:20};
test('Ollama uses schema-constrained tool calls, a fixed local endpoint and usage limits',async()=>{
 const fake=(async(url,options)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/chat');
  const body=JSON.parse(String(options?.body));assert.equal(body.stream,false);assert.equal(body.think,false);assert.equal(body.options.num_predict,256);
  assert.equal(body.tools,undefined);assert.ok(body.format.anyOf);
  assert.ok(!JSON.stringify(body.format).includes('send_email'));
  return new Response(JSON.stringify(result));
 }) as typeof fetch;
 const planner=new OllamaPlanner('qwen3:1.7b',fake);
 assert.deepEqual(await planner.next(input),validCall);
 assert.equal(planner.metrics().inputTokens,100);assert.equal(planner.metrics().outputTokens,20);
 for(let i=0;i<3;i++)await planner.next(input);
 await assert.rejects(planner.next(input),/usage limit/);
});
test('provider failures and malformed or multiple tool calls fail closed',async()=>{
 for(const body of [{...result,message:{content:'I sent it'}},{...result,message:{content:'not JSON'}},{...result,eval_count:-1}]){
  const planner=new OllamaPlanner('qwen3:1.7b',(async()=>new Response(JSON.stringify(body))) as typeof fetch);
  await assert.rejects(planner.next(input),/valid tool call/);
 }
 await assert.rejects(new OllamaPlanner('qwen3:1.7b',(async()=>new Response('',{status:500})) as typeof fetch).next(input),/unavailable/);
});
test('parallel model calls are rejected rather than silently queued',async()=>{
 let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const fake=(async()=>{await gate;return new Response(JSON.stringify(result));}) as typeof fetch;
 const first=new OllamaPlanner('qwen3:1.7b',fake).next(input);
 try{await assert.rejects(new OllamaPlanner('qwen3:1.7b',fake).next(input),/busy/);}finally{release();await first;}
});

test('cloud or arbitrary model names cannot be selected',()=>{assert.throws(()=>new OllamaPlanner('remote:cloud'),/allowlisted local model/);});


test('provider validates arguments and current stage before returning a call',async()=>{
 for(const call of [
  {name:'list_bookings_requiring_attention',arguments:{filter:'unpaid_balances_and_missing_documents',agencyId:'agency-b'}},
  {name:'prepare_reminder_draft',arguments:{delivery:'draft_only'}},
  {name:'send_email',arguments:{}},
  {name:'stop',arguments:{reason:'invalid'}}
 ]){
  const fake=(async()=>new Response(JSON.stringify({...result,message:{content:JSON.stringify(call)}}))) as typeof fetch;
  await assert.rejects(new OllamaPlanner('qwen3:4b',fake).next(input),/invalid arguments or an unavailable tool/);
 }
});

test('valid refusal returns stop without converting free text to an action',async()=>{
 const call={name:'stop',arguments:{reason:'approval_required'}};
 const fake=(async()=>new Response(JSON.stringify({...result,message:{content:JSON.stringify(call)}}))) as typeof fetch;
 assert.deepEqual(await new OllamaPlanner('qwen3:4b',fake).next(input),call);
});


test('aborted model requests fail closed and release the concurrency slot',async()=>{
 const controller=new AbortController();
 const fake=(async(_url,options)=>{return new Promise((_resolve,reject)=>{options!.signal!.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});}) as typeof fetch;
 const pending=new OllamaPlanner('qwen3:4b',fake).next({...input,signal:controller.signal});controller.abort();
 await assert.rejects(pending,/timed out/);
 const healthy=new OllamaPlanner('qwen3:4b',(async()=>new Response(JSON.stringify(result))) as typeof fetch);
 assert.deepEqual(await healthy.next(input),validCall);
});
test('oversized context and cumulative output budgets block further model work',async()=>{
 let calls=0;const fake=(async()=>{calls++;return new Response(JSON.stringify({...result,eval_count:1025}));}) as typeof fetch;
 const planner=new OllamaPlanner('qwen3:4b',fake);
 await assert.rejects(planner.next({...input,results:[{name:'search_contract_sources',output:'x'.repeat(6001)}]}),/context exceeded/);assert.equal(calls,0);
 await assert.rejects(planner.next(input),/usage limit/);await assert.rejects(planner.next(input),/usage limit/);assert.equal(calls,1);
});
