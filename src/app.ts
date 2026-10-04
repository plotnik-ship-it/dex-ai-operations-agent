import {PlannerError} from './ollama.js';
import {ApprovalService,ReviewError} from './approval.js';
import {runReminderAgent,DemoPlanner,type Planner} from './agent.js';
import {LocalEmbedder} from './embeddings.js';
import { resolveDeadline } from './contracts.js';
import Fastify from 'fastify';
import type { Identity } from './auth.js';
import type { OperationsStore } from './store.js';
const groupSchema={
 params:{type:'object',additionalProperties:false,required:['groupId'],properties:{groupId:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,128}$'}}},
 querystring:{type:'object',additionalProperties:false,properties:{}}
};
export function buildApp(store:OperationsStore,authenticate:(header:string|undefined)=>Identity|null,approvals?:ApprovalService,createPlanner:()=>Planner=()=>new DemoPlanner()) {
 const app=Fastify({ajv:{customOptions:{removeAdditional:false}},logger:{redact:['req.headers.authorization']}});
 app.get('/health',async()=>({status:'ok',service:'dex-api',stage:'contract-evidence',llmMode:createPlanner().mode}));
 app.get<{Params:{groupId:string}}>('/groups/:groupId/attention',{schema:groupSchema},async(request,reply)=>{
  const identity=authenticate(request.headers.authorization);
  if(!identity)return reply.code(401).send({error:'Authentication required'});
  const findings=await store.attention(identity,request.params.groupId);
  if(findings===null)return reply.code(404).send({error:'Group unavailable'});
  return {groupId:request.params.groupId,findings,deliveryEnabled:false};
 });
 app.get<{Params:{groupId:string}}>('/groups/:groupId/deadlines',{schema:groupSchema},async(request,reply)=>{
  const identity=authenticate(request.headers.authorization);
  if(!identity)return reply.code(401).send({error:'Authentication required'});
  if(!store.contractSources)return reply.code(503).send({error:'Contract retrieval unavailable'});
  const sources=await store.contractSources(identity,request.params.groupId);
  if(sources===null)return reply.code(404).send({error:'Group unavailable'});
  return {groupId:request.params.groupId,retrievalMode:'fixture-evidence',deadlines:[resolveDeadline(sources,'payment'),resolveDeadline(sources,'documents')],deliveryEnabled:false};
 });
 app.post<{Params:{groupId:string};Body:{request:string}}>('/groups/:groupId/reminder-runs',{
 schema:{...groupSchema,body:{type:'object',additionalProperties:false,required:['request'],properties:{request:{type:'string',minLength:1,maxLength:2000}}}}
 },async(request,reply)=>{
  const identity=authenticate(request.headers.authorization);
  if(!identity)return reply.code(401).send({error:'Authentication required'});
  try{return await runReminderAgent(store,new LocalEmbedder(),createPlanner(),identity,request.params.groupId,request.body.request);}
  catch(error){if(error instanceof PlannerError)return reply.code(error.statusCode).send({error:error.message});if(error instanceof Error && error.message==='Group unavailable')return reply.code(404).send({error:'Group unavailable'});throw error;}
 });
 app.get<{Params:{groupId:string}}>('/groups/:groupId/runs',{schema:groupSchema},async(request,reply)=>{
  const identity=authenticate(request.headers.authorization);if(!identity)return reply.code(401).send({error:'Authentication required'});
  if(!store.listRuns)return reply.code(503).send({error:'Run history unavailable'});
  const runs=await store.listRuns(identity,request.params.groupId);
  if(runs===null)return reply.code(404).send({error:'Group unavailable'});
  return {runs};
 });
 app.get<{Params:{groupId:string;runId:string}}>('/groups/:groupId/runs/:runId/trace',{schema:{params:{type:'object',additionalProperties:false,required:['groupId','runId'],properties:{groupId:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,128}$'},runId:{type:'string',format:'uuid'}}},querystring:groupSchema.querystring}},async(request,reply)=>{
  const identity=authenticate(request.headers.authorization);if(!identity)return reply.code(401).send({error:'Authentication required'});
  if(!store.getTrace)return reply.code(503).send({error:'Tracing unavailable'});
  const trace=await store.getTrace(identity,request.params.groupId,request.params.runId);
  return trace??reply.code(404).send({error:'Trace unavailable'});
 });
 if(approvals){
 const draftSchema={params:{type:'object',additionalProperties:false,required:['draftId'],properties:{draftId:{type:'string',format:'uuid'}}},querystring:{type:'object',additionalProperties:false,properties:{}}};
 app.get<{Params:{draftId:string}}>('/drafts/:draftId',{schema:draftSchema},async(request,reply)=>{
  const identity=authenticate(request.headers.authorization);if(!identity)return reply.code(401).send({error:'Authentication required'});
  try{return await approvals.review(identity,request.params.draftId);}catch(error){if(error instanceof ReviewError)return reply.code(error.statusCode).send({error:error.message});throw error;}
 });
 app.post<{Params:{draftId:string};Body:{reviewHash:string;confirm:true}}>('/drafts/:draftId/approve',{schema:{...draftSchema,body:{type:'object',additionalProperties:false,required:['reviewHash','confirm'],properties:{reviewHash:{type:'string',pattern:'^[a-f0-9]{64}$'},confirm:{const:true}}}}},async(request,reply)=>{
  const identity=authenticate(request.headers.authorization);if(!identity)return reply.code(401).send({error:'Authentication required'});
  try{return await approvals.approve(identity,request.params.draftId,request.body.reviewHash);}catch(error){if(error instanceof ReviewError)return reply.code(error.statusCode).send({error:error.message});throw error;}
 });
 }
 return app;
}
