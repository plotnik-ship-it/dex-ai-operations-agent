import {randomUUID} from 'node:crypto';
import {EMBEDDING_MODEL} from './embeddings.js';
import { Pool, type PoolClient } from 'pg';
import type { Identity } from './auth.js';
import type { ContractSource } from './contracts.js';
import {insertTrace,type TraceEvent} from './tracing.js';
export interface Finding { id:string; groupId:string; balanceMinor:string; currency:string; missingDocuments:string[] }
export interface RunCompletion {status:string;durationMs:number;events:unknown[];modelUsage:unknown;draftId:string|null;errorCode:string|null}
export interface OperationsStore {
 appendTrace?(identity:Identity,groupId:string,runId:string,event:TraceEvent):Promise<boolean>;
 getTrace?(identity:Identity,groupId:string,runId:string):Promise<unknown|null>;
 startRun?(identity:Identity,groupId:string,runId:string,plannerMode:string):Promise<boolean>;
 finishRun?(identity:Identity,groupId:string,runId:string,result:RunCompletion):Promise<boolean>;
 listRuns?(identity:Identity,groupId:string):Promise<unknown[]|null>;
 attention(identity:Identity,groupId:string):Promise<Finding[] | null>;
 searchSources?(identity:Identity,groupId:string,query:string,vector:number[]):Promise<ContractSource[]|null>;
 saveDraft?(identity:Identity,groupId:string,payload:unknown):Promise<{id:string;expiresAt:string}|null>;
 contractSources?(identity:Identity,groupId:string):Promise<ContractSource[] | null>;
}
export class PostgresOperationsStore implements OperationsStore {
 constructor(private readonly pool:Pool) {}
 async appendTrace(identity:Identity,groupId:string,runId:string,event:TraceEvent){
  return !!await this.scoped(identity,groupId,async client=>{const run=await client.query('SELECT id FROM agent_runs WHERE id=$1 AND group_id=$2',[runId,groupId]);if(!run.rowCount)return false;await insertTrace(client,runId,event);return true;},true);
 }
 async getTrace(identity:Identity,groupId:string,runId:string){
  return this.scoped(identity,groupId,async client=>{
   const run=await client.query('SELECT * FROM agent_runs WHERE id=$1 AND group_id=$2',[runId,groupId]);if(!run.rowCount)return null;
   const events=await client.query('SELECT sequence::text,id,event_type AS type,occurred_at AS timestamp,span_id AS "spanId",parent_span_id AS "parentSpanId",duration_ms AS "durationMs",data FROM trace_events WHERE run_id=$1 ORDER BY trace_events.sequence',[runId]);
   const delivery=await client.query('SELECT j.id,j.status,j.created_at,j.started_at,j.finished_at,j.outcomes,j.reason FROM delivery_jobs j WHERE j.draft_id=$1',[run.rows[0].draft_id]);
   return {traceId:runId,run:run.rows[0],events:events.rows,delivery:delivery.rows[0]??null};
  });
 }
 private async scoped<T>(identity:Identity,groupId:string,read:(client:PoolClient)=>Promise<T>,write=false):Promise<T|null> {
  const client=await this.pool.connect();
  let destroyed=false;
  try {
   await client.query(write?'BEGIN ISOLATION LEVEL REPEATABLE READ':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   await client.query("SELECT set_config('dex.user_id',$1,true),set_config('dex.agency_id',$2,true)",[identity.userId,identity.agencyId]);
   const group=await client.query('SELECT id FROM groups WHERE id=$1',[groupId]);
   const result=group.rowCount?await read(client):null;
   await client.query('COMMIT');
   return result;
  } catch(error) {
   try {await client.query('ROLLBACK');}catch {destroyed=true;client.release(true);throw error;}
   throw error;
  } finally {if(!destroyed)client.release();}
 }
 async startRun(identity:Identity,groupId:string,runId:string,plannerMode:string):Promise<boolean>{
  return !!await this.scoped(identity,groupId,async client=>{
   await client.query('INSERT INTO agent_runs(id,agency_id,group_id,created_by,planner_mode) VALUES($1,$2,$3,$4,$5)',[runId,identity.agencyId,groupId,identity.userId,plannerMode]);return true;
  },true);
 }
 async finishRun(identity:Identity,groupId:string,runId:string,result:RunCompletion):Promise<boolean>{
  return !!await this.scoped(identity,groupId,async client=>{
   const updated=await client.query("UPDATE agent_runs SET status=$2,finished_at=now(),duration_ms=$3,events=$4,model_usage=$5,draft_id=$6,error_code=$7 WHERE id=$1 AND status='running'",[runId,result.status,result.durationMs,JSON.stringify(result.events),JSON.stringify(result.modelUsage),result.draftId,result.errorCode]);return updated.rowCount===1;
  },true);
 }
 async listRuns(identity:Identity,groupId:string):Promise<unknown[]|null>{
  return this.scoped(identity,groupId,async client=>(await client.query(
   'SELECT id,planner_mode AS "plannerMode",status,started_at AS "startedAt",finished_at AS "finishedAt",duration_ms AS "durationMs",events,model_usage AS "modelUsage",draft_id AS "draftId",error_code AS "errorCode" FROM agent_runs WHERE group_id=$1 ORDER BY started_at DESC,id DESC LIMIT 20',[groupId])).rows);
 }
 async attention(identity:Identity,groupId:string):Promise<Finding[] | null> {
  return this.scoped(identity,groupId,async client=>{
   const result=await client.query('SELECT id, group_id AS "groupId", (total_minor-paid_minor)::text AS "balanceMinor", currency, missing_documents AS "missingDocuments" FROM bookings WHERE group_id=$1 AND status=$2 AND total_minor>paid_minor AND cardinality(missing_documents)>0 ORDER BY id',[groupId,'active']);
   return result.rows as Finding[];
  });
 }
 async contractSources(identity:Identity,groupId:string):Promise<ContractSource[]|null> {
  return this.scoped(identity,groupId,async client=>{
   const result=await client.query('SELECT ch.id, c.id AS "contractId", c.title, c.version, ch.page, ch.section, ch.excerpt FROM contracts c JOIN contract_chunks ch ON ch.agency_id=c.agency_id AND ch.contract_id=c.id WHERE c.group_id=$1 AND c.active ORDER BY c.id,ch.page,ch.id',[groupId]);
   return result.rows as ContractSource[];
  });
 }
 async searchSources(identity:Identity,groupId:string,query:string,vector:number[]):Promise<ContractSource[]|null> {
  if(vector.length!==384||vector.some(v=>!Number.isFinite(v)))throw new Error('Invalid search vector');
  return this.scoped(identity,groupId,async client=>{
   const result=await client.query(`SELECT ch.id,c.id AS "contractId",c.title,c.version,ch.page,ch.section,ch.excerpt
    FROM contracts c JOIN contract_chunks ch ON ch.agency_id=c.agency_id AND ch.contract_id=c.id
    WHERE c.group_id=$1 AND c.active AND ch.embedding IS NOT NULL AND ch.embedding_model LIKE $4
    ORDER BY (1-(ch.embedding <=> $2::vector))+ts_rank_cd(to_tsvector('english',ch.excerpt),plainto_tsquery('english',$3)) DESC,ch.id LIMIT 8`,[groupId,JSON.stringify(vector),query,EMBEDDING_MODEL+':%']);
   if(!result.rows.length)throw new Error('Contract embeddings unavailable; run index:contracts');
   return result.rows as ContractSource[];
  });
 }
 async saveDraft(identity:Identity,groupId:string,payload:unknown):Promise<{id:string;expiresAt:string}|null> {
  return this.scoped(identity,groupId,async client=>{
   const result=await client.query('INSERT INTO reminder_drafts(id,agency_id,group_id,created_by,payload) VALUES($1,$2,$3,$4,$5) RETURNING id,expires_at AS "expiresAt"',[randomUUID(),identity.agencyId,groupId,identity.userId,JSON.stringify(payload)]);
   return result.rows[0];
  },true);
 }
}
