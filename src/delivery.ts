import type {Pool} from 'pg';
import nodemailer from 'nodemailer';
import {ApprovalService,type ApprovedMessage} from './approval.js';
export interface MailTransport {send(message:ApprovedMessage,key:string):Promise<void>}
// Fixed loopback transport and envelope: no model or caller-controlled SMTP destination.
export class MailpitTransport implements MailTransport {
 private transport=nodemailer.createTransport({host:'127.0.0.1',port:1025,secure:false,ignoreTLS:true,connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000});
 async send(message:ApprovedMessage,key:string){
  if(message.deliveryDestination!=='demo@example.test')throw Error('Test inbox required');
  await this.transport.sendMail({from:'Dex Demo <dex@example.test>',to:'demo@example.test',subject:message.subject,text:message.body,messageId:'<'+key+'@dex.example.test>'});
 }
}
export async function processNextJob(queue:Pool,approvals:ApprovalService,transport:MailTransport){
 // A crash after SMTP acceptance cannot be retried safely. Stale claims become uncertain.
 await queue.query("UPDATE delivery_jobs SET status='uncertain',reason='worker_interrupted',finished_at=now() WHERE status='sending' AND started_at<now()-interval '5 minutes'");
 const claim=await queue.query("UPDATE delivery_jobs SET status='sending',started_at=now() WHERE id=(SELECT id FROM delivery_jobs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *");
 if(!claim.rowCount)return null;
 const job=claim.rows[0],identity={userId:job.actor_id,agencyId:job.agency_id};
 const started=Date.now();
 const trace=(type:string,data:unknown)=>approvals.traceDelivery(identity,job.draft_id,type,{jobId:job.id,...data as object},job.id,Date.now()-started);
 await trace('delivery_claimed',{attempt:1,retries:0});
 const outcomes:{bookingId:string;status:string}[]=[];
 let messages:ApprovedMessage[];
 try{messages=await approvals.forDelivery(identity,job.draft_id);}catch{
  await trace('permission_check',{boundary:'delivery',allowed:false});
  await queue.query("UPDATE delivery_jobs SET status='blocked',reason='approval_or_data_no_longer_valid',finished_at=now() WHERE id=$1",[job.id]);return {jobId:job.id,status:'blocked'};
 }
 await trace('permission_check',{boundary:'delivery',allowed:true,checks:['approval','current_membership','group_access','expiry','content_hash','current_booking','current_contract']});
 for(const message of messages){
  try {
   await approvals.forDelivery(identity,job.draft_id);
  }catch {
   await trace('delivery_blocked',{reason:'approval_or_data_no_longer_valid',retries:0});
   await queue.query("UPDATE delivery_jobs SET status='blocked',reason='approval_or_data_no_longer_valid',outcomes=$2,finished_at=now() WHERE id=$1",[job.id,JSON.stringify(outcomes)]);return {jobId:job.id,status:'blocked'};
  }
  try {
   await trace('delivery_attempt',{bookingId:message.bookingId,idempotencyKey:job.id+'-'+message.bookingId,attempt:1});
   await transport.send(message,job.id+'-'+message.bookingId);
   outcomes.push({bookingId:message.bookingId,status:'sent'});
   await queue.query('UPDATE delivery_jobs SET outcomes=$2 WHERE id=$1',[job.id,JSON.stringify(outcomes)]);
   await trace('delivery_result',{bookingId:message.bookingId,status:'sent'});
  }catch {
   await trace('delivery_error',{bookingId:message.bookingId,status:'uncertain',reason:'delivery_unconfirmed',retries:0});
   outcomes.push({bookingId:message.bookingId,status:'uncertain'});
   await queue.query("UPDATE delivery_jobs SET status='uncertain',reason='delivery_unconfirmed',outcomes=$2,finished_at=now() WHERE id=$1",[job.id,JSON.stringify(outcomes)]);return {jobId:job.id,status:'uncertain'};
  }
 }
 await queue.query("UPDATE delivery_jobs SET status='sent',finished_at=now() WHERE id=$1",[job.id]);await trace('delivery_finished',{status:'sent',outcomes,retries:0});return {jobId:job.id,status:'sent'};
}
