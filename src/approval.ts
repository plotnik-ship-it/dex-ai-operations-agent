import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {Identity} from './auth.js';
import {resolveDeadline} from './contracts.js';
import {z} from 'zod';
import {insertTrace,traceEvent} from './tracing.js';
const message=z.object({bookingId:z.string(),deliveryDestination:z.literal('demo@example.test'),subject:z.string().min(1).max(200),body:z.string().min(1).max(10000),balanceMinor:z.string().regex(/^[0-9]+$/),currency:z.string(),missingDocuments:z.array(z.string())});
const payloadSchema=z.object({status:z.literal('pending_review'),drafts:z.array(message).min(1).max(20),deadlines:z.array(z.unknown())}).passthrough();
export type ApprovedMessage=z.infer<typeof message>;
export function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value && typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
export function payloadHash(payload:unknown){return createHash('sha256').update(canonical(payload)).digest('hex');}
export class ReviewError extends Error {constructor(public statusCode:number,message:string){super(message);}}
export class ApprovalService {
 constructor(private pool:Pool){}
 private async trace(client:PoolClient,draft:any,type:string,data:unknown,spanId:string,durationMs:number|null=null){
  const runId=draft.payload?.runId;if(typeof runId!=='string'||!z.uuid().safeParse(runId).success)return;
  const run=await client.query('SELECT id FROM agent_runs WHERE id=$1 AND group_id=$2',[runId,draft.group_id]);
  if(run.rowCount)await insertTrace(client,runId,traceEvent(type,{draftId:draft.id,...data as object},spanId,runId,durationMs));
 }
 // Worker telemetry is best effort: a telemetry failure must never repeat SMTP.
 async traceDelivery(identity:Identity,id:string,type:string,data:unknown,spanId:string,durationMs:number|null=null){
  try{await this.transaction(identity,async client=>{const draft=await this.draft(client,id);await this.trace(client,draft,type,data,spanId,durationMs);});return true;}
  catch{console.warn(JSON.stringify({service:'dex-trace',event:'write_unavailable',draftId:id,spanId}));return false;}
 }
 private async transaction<T>(identity:Identity,fn:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await this.pool.connect();let discard=false;
  try {await client.query('BEGIN');await client.query("SELECT set_config('dex.user_id',$1,true),set_config('dex.agency_id',$2,true)",[identity.userId,identity.agencyId]);const result=await fn(client);await client.query('COMMIT');return result;}
  catch(error){try{await client.query('ROLLBACK');}catch{discard=true;}throw error;}finally{client.release(discard);}
 }
 private async draft(client:PoolClient,id:string){
  const result=await client.query('SELECT * FROM reminder_drafts WHERE id=$1',[id]);
  if(!result.rowCount)throw new ReviewError(404,'Draft unavailable');return result.rows[0];
 }
 private async validate(client:PoolClient,draft:any,expectedHash:string){
  if(payloadHash(draft.payload)!==expectedHash)throw new ReviewError(409,'Reviewed content changed');
  if(new Date(draft.expires_at).getTime()<=Date.now())throw new ReviewError(409,'Draft expired');
  const parsed=payloadSchema.safeParse(draft.payload);
  if(!parsed.success)throw new ReviewError(409,'Draft requires review');
  if(new Set(parsed.data.drafts.map(m=>m.bookingId)).size!==parsed.data.drafts.length)throw new ReviewError(409,'Duplicate booking');
  const sources=await client.query('SELECT ch.id,c.id AS "contractId",c.title,c.version,ch.page,ch.section,ch.excerpt FROM contracts c JOIN contract_chunks ch ON ch.agency_id=c.agency_id AND ch.contract_id=c.id WHERE c.group_id=$1 AND c.active ORDER BY c.id,ch.id',[draft.group_id]);
  const deadlines=[resolveDeadline(sources.rows,'payment'),resolveDeadline(sources.rows,'documents')];
  const normalize=(items:any[])=>items.map(d=>({...d,sources:[...d.sources].sort((a,b)=>a.id.localeCompare(b.id))}));
  if(deadlines.some(d=>d.status!=='supported') || canonical(normalize(deadlines))!==canonical(normalize(parsed.data.deadlines)))throw new ReviewError(409,'Contract evidence changed');
  for(const item of parsed.data.drafts){
   const current=await client.query('SELECT (total_minor-paid_minor)::text AS balance,currency,missing_documents,status FROM bookings WHERE id=$1 AND group_id=$2',[item.bookingId,draft.group_id]);
   const row=current.rows[0];
   if(!row || row.status!=='active' || row.balance!==item.balanceMinor || row.currency!==item.currency || canonical(row.missing_documents)!==canonical(item.missingDocuments) || BigInt(row.balance)<=0n || !row.missing_documents.length)throw new ReviewError(409,'Booking changed; prepare a new draft');
  }
  return parsed.data.drafts;
 }
 review(identity:Identity,id:string){return this.transaction(identity,async client=>{
  const draft=await this.draft(client,id);
  const job=await client.query('SELECT id,status,outcomes,reason FROM delivery_jobs WHERE draft_id=$1',[id]);
  return {draftId:id,payload:draft.payload,reviewHash:payloadHash(draft.payload),expiresAt:draft.expires_at,delivery:job.rows[0]??null};
 });}
 approve(identity:Identity,id:string,reviewHash:string){return this.transaction(identity,async client=>{
  const spanId=randomUUID(),started=Date.now();
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
  const draft=await this.draft(client,id);
  const existing=await client.query('SELECT j.id,j.status,a.payload_hash FROM delivery_jobs j JOIN reminder_approvals a ON a.draft_id=j.draft_id WHERE j.draft_id=$1',[id]);
  if(existing.rowCount){if(existing.rows[0].payload_hash!==reviewHash)throw new ReviewError(409,'Approval hash differs');await this.trace(client,draft,'approval_duplicate',{jobId:existing.rows[0].id,executionPrevented:true},spanId,Date.now()-started);return {jobId:existing.rows[0].id,status:existing.rows[0].status};}
  await this.validate(client,draft,reviewHash);
  await this.trace(client,draft,'permission_check',{boundary:'approval',allowed:true,checks:['creator','current_membership','group_access','expiry','content_hash','current_booking','current_contract']},spanId);
  await client.query('INSERT INTO reminder_approvals(draft_id,agency_id,actor_id,payload_hash) VALUES($1,$2,$3,$4)',[id,identity.agencyId,identity.userId,reviewHash]);
  const jobId=randomUUID();
  await client.query('INSERT INTO delivery_jobs(id,draft_id,agency_id,actor_id) VALUES($1,$2,$3,$4)',[jobId,id,identity.agencyId,identity.userId]);
  await this.trace(client,draft,'approval_confirmed',{jobId,status:'queued',reviewHash},spanId,Date.now()-started);
  return {jobId,status:'queued'};
 }).catch(async error=>{
  await this.traceDelivery(identity,id,'approval_denied',{allowed:false,errorCode:error instanceof ReviewError?'review_rejected':'approval_failed'},randomUUID());
  throw error;
 });}
 forDelivery(identity:Identity,id:string){return this.transaction(identity,async client=>{
  const draft=await this.draft(client,id);
  const approval=await client.query('SELECT payload_hash FROM reminder_approvals WHERE draft_id=$1',[id]);
  if(!approval.rowCount)throw new ReviewError(409,'Approval required');
  return this.validate(client,draft,approval.rows[0].payload_hash);
 });}
}
