import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Identity} from './auth.js';
import type {OperationsStore,Finding} from './store.js';
import type {Embedder} from './embeddings.js';
import {resolveDeadline,type ContractSource} from './contracts.js';
import {traceEvent} from './tracing.js';
export const toolCall=z.discriminatedUnion('name',[
 z.object({name:z.literal('list_bookings_requiring_attention'),arguments:z.object({filter:z.literal('unpaid_balances_and_missing_documents')}).strict()}).strict(),
 z.object({name:z.literal('search_contract_sources'),arguments:z.object({query:z.string().min(1).max(512)}).strict()}).strict(),
 z.object({name:z.literal('prepare_reminder_draft'),arguments:z.object({delivery:z.literal('draft_only')}).strict()}).strict(),
 z.object({name:z.literal('stop'),arguments:z.object({reason:z.enum(['out_of_scope','approval_required'])}).strict()}).strict()
]);
export interface ToolEvent {name:string;durationMs:number;status:'ok'}
export interface PlannerInput {request:string;completed:string[];results?:{name:string;arguments?:unknown;output:unknown}[];signal?:AbortSignal}
export interface Planner {mode:string;next(input:PlannerInput):Promise<unknown>;metrics?():unknown}
// Offline contract test double. It is a scripted planner, not an LLM.
export class DemoPlanner implements Planner {
 mode='scripted-demo';
 async next(input:{completed:string[]}) {
  return [{name:'list_bookings_requiring_attention',arguments:{filter:'unpaid_balances_and_missing_documents'}},{name:'search_contract_sources',arguments:{query:'When must the remaining payment be settled and passport copies submitted?'}},{name:'prepare_reminder_draft',arguments:{delivery:'draft_only'}}][input.completed.length];
 }
}
export async function runReminderAgent(store:OperationsStore,embedder:Embedder,planner:Planner,identity:Identity,groupId:string,request:string) {
 const started=Date.now(),runId=randomUUID(),events:ToolEvent[]=[];
 if(store.startRun && !await store.startRun(identity,groupId,runId,planner.mode))throw new Error('Group unavailable');
 const emit=async(type:string,data:unknown,spanId:string=runId,durationMs:number|null=null)=>{if(store.appendTrace && !await store.appendTrace(identity,groupId,runId,traceEvent(type,data,spanId,spanId===runId?null:runId,durationMs)))throw new Error('Group unavailable');};
 let result:Awaited<ReturnType<typeof executeReminder>>;
 try {
  await emit('user_request',{request,groupId,plannerMode:planner.mode});
  await emit('permission_check',{boundary:'run_creation',allowed:true,source:store.startRun?'database_rls':'test_adapter'});
  result=await executeReminder(store,embedder,planner,identity,groupId,request,runId,events,emit);
  await emit('final_answer',{result,modelUsage:planner.metrics?.()??null,retries:0},runId,Date.now()-started);
 }
 catch(error){
  // Store only a controlled category, never provider responses, prompts or stack traces.
  const errorCode=error instanceof Error && error.name==='ZodError'?'invalid_tool_call':error instanceof Error && error.message==='Group unavailable'?'access_changed':'run_failed';
  try{await emit('run_error',{errorCode,retries:0,finalAnswer:'The run failed safely; no automatic delivery was authorized.',modelUsage:planner.metrics?.()??null},runId,Date.now()-started);}catch{/* Do not mask the original failure or bypass revoked access. */}
  await store.finishRun?.(identity,groupId,runId,{status:'failed',durationMs:Date.now()-started,events,modelUsage:planner.metrics?.()??null,draftId:null,errorCode});
  throw error;
 }
 const recorded=await store.finishRun?.(identity,groupId,runId,{status:result.status,durationMs:Date.now()-started,events,modelUsage:planner.metrics?.()??null,draftId:result.draftId,errorCode:null});
 return {...result,traceId:runId,historyRecorded:recorded??false};
}
async function executeReminder(store:OperationsStore,embedder:Embedder,planner:Planner,identity:Identity,groupId:string,request:string,runId:string,events:ToolEvent[],emit:(type:string,data:unknown,spanId?:string,durationMs?:number|null)=>Promise<void>) {
 const results:{name:string;arguments?:unknown;output:unknown}[]=[];
 const signal=AbortSignal.timeout(120000);
 let findings:Finding[]|undefined,sources:ContractSource[]|undefined;
 if(!store.searchSources || !store.saveDraft || !store.contractSources)throw new Error('Agent dependencies unavailable');
 for(let step=0;step<5;step++) {
  if(signal.aborted)throw new Error('Run time budget exceeded');
  const modelSpan=randomUUID(),modelStarted=Date.now();
  await emit('model_started',{step,attempt:1},modelSpan);
  let call:z.infer<typeof toolCall>;
  try{call=toolCall.parse(await planner.next({request,completed:events.map(e=>e.name),results,signal}));}
  catch(error){await emit('model_error',{step,errorCode:error instanceof z.ZodError?'invalid_tool_call':'model_failed',attempt:1,retries:0,modelUsage:planner.metrics?.()??null},modelSpan,Date.now()-modelStarted);throw error;}
  await emit('model_decision',{step,decision:call,modelUsage:planner.metrics?.()??null},modelSpan,Date.now()-modelStarted);
  if(call.name==='stop')return {runId,plannerMode:planner.mode,status:'no_action',message:'This request could not be completed within the authorized reminder workflow.',drafts:[],deadlines:[],events,deliveryEnabled:false,draftId:null,expiresAt:null};
  if(events.some(e=>e.name===call.name))throw new Error('Repeated tool call blocked');
  const toolStarted=Date.now();
  const toolSpan=randomUUID();
  await emit('tool_selected',{tool:call.name,arguments:call.arguments,attempt:1},toolSpan);
  try {
  if(call.name==='list_bookings_requiring_attention') {
   const result=await store.attention(identity,groupId);
   await emit('permission_check',{boundary:'booking_read',allowed:result!==null},toolSpan);
   if(result===null)throw new Error('Group unavailable');
   if(result.length>20)throw new Error('Review at most 20 bookings per run');
   findings=result;
   results.push({name:call.name,arguments:call.arguments,output:result});
  }else if(call.name==='search_contract_sources') {
   if(!findings)throw new Error('Booking lookup required before retrieval');
   const query=call.arguments.query;
   const vector=await embedder.embed(query);
   const ranked=await store.searchSources(identity,groupId,query,vector);
   await emit('permission_check',{boundary:'source_search',allowed:ranked!==null},toolSpan);
   if(ranked===null)throw new Error('Group unavailable');
   // Expand the authorized evidence set: top-k alone can hide contradictory clauses.
   const full=await store.contractSources(identity,groupId);
   await emit('permission_check',{boundary:'source_expansion',allowed:full!==null},toolSpan);
   if(full===null)throw new Error('Group unavailable');
   sources=[...ranked,...full.filter(source=>!ranked.some(hit=>hit.id===source.id && hit.contractId===source.contractId))];
   results.push({name:call.name,arguments:call.arguments,output:sources.map(s=>({id:s.id,section:s.section,excerpt:s.excerpt}))});
  }else {
   if(!findings || !sources)throw new Error('Bookings and evidence required before drafting');
   const deadlines=[resolveDeadline(sources,'payment'),resolveDeadline(sources,'documents')];
   const blocked=deadlines.some(d=>d.status!=='supported');
   const drafts=blocked?[]:findings.map(booking=>({
    bookingId:booking.id,deliveryDestination:'demo@example.test',
    subject:'Action needed for your booking '+booking.id,
    body:'Hello,\n\nYour booking '+booking.id+' has an outstanding balance of '+booking.currency+' '+formatMoney(booking.balanceMinor)+'. Please complete payment by '+deadlines[0]!.date+'.\nMissing documents: '+booking.missingDocuments.join(', ')+'. Please submit them by '+deadlines[1]!.date+'.\n\nIf you have already completed these steps, please contact your travel agency.',
    balanceMinor:booking.balanceMinor,currency:booking.currency,missingDocuments:booking.missingDocuments
   }));
   events.push({name:call.name,durationMs:Date.now()-toolStarted,status:'ok'});
   const payload={runId,plannerMode:planner.mode,status:blocked?'needs_review':drafts.length?'pending_review':'no_action',drafts,deadlines,events,modelUsage:planner.metrics?.()??null,deliveryEnabled:false,estimatedProviderCostUsd:0};
   const saved=await store.saveDraft(identity,groupId,payload);
   await emit('permission_check',{boundary:'draft_persistence',allowed:saved!==null},toolSpan);
   if(!saved)throw new Error('Group unavailable');
   await emit('tool_result',{tool:call.name,status:payload.status,draftId:saved.id,drafts,deadlines},toolSpan,Date.now()-toolStarted);
   return {...payload,draftId:saved.id,expiresAt:saved.expiresAt};
  }
  events.push({name:call.name,durationMs:Date.now()-toolStarted,status:'ok'});
  await emit('tool_result',{tool:call.name,output:results.at(-1)?.output},toolSpan,Date.now()-toolStarted);
  }catch(error){await emit('tool_error',{tool:call.name,errorCode:error instanceof Error && error.message==='Group unavailable'?'access_denied':'tool_failed',attempt:1,retries:0},toolSpan,Date.now()-toolStarted);throw error;}
 }
 throw new Error('Tool budget exceeded');
}
function formatMoney(value:string) {const n=BigInt(value);return (n/100n).toString()+'.'+(n%100n).toString().padStart(2,'0');}
