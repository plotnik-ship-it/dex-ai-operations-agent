import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
export interface TraceEvent {id:string;timestamp:string;type:string;spanId:string;parentSpanId:string|null;durationMs:number|null;data:unknown}
// Never capture hidden reasoning, raw provider responses or credentials.
export function sanitizeTrace(value:unknown,depth=0):unknown {
 if(depth>8)return '[depth limit]';
 if(typeof value==='string')return value.replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email]').replace(/((?:password|api[_-]?key|secret|authorization)\s*[:=]\s*)\S+/gi,'$1[redacted]').slice(0,12000);
 if(Array.isArray(value))return value.slice(0,40).map(v=>sanitizeTrace(v,depth+1));
 if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,60).map(([k,v])=>[k,/^(authorization|password|secret|apiKey|accessToken|refreshToken|chainOfThought|reasoning)$/i.test(k)?'[redacted]':sanitizeTrace(v,depth+1)]));
 return value??null;
}
export function traceEvent(type:string,data:unknown,spanId:string,parentSpanId:string|null=null,durationMs:number|null=null):TraceEvent {
 return {id:randomUUID(),timestamp:new Date().toISOString(),type,spanId,parentSpanId,durationMs,data:sanitizeTrace(data)};
}
export async function insertTrace(client:PoolClient,runId:string,event:TraceEvent){
 await client.query('INSERT INTO trace_events(id,run_id,event_type,occurred_at,span_id,parent_span_id,duration_ms,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[event.id,runId,event.type,event.timestamp,event.spanId,event.parentSpanId,event.durationMs,JSON.stringify(sanitizeTrace(event.data))]);
}
