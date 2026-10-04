import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite-pgvector';
import {PostgresOperationsStore} from '../dist/src/store.js';
import {resolveDeadline} from '../dist/src/contracts.js';
// Ephemeral, single-user demonstration. Production uses the pg Pool adapter.
const db=new PGlite({extensions:{vector}});
try {
 for(const file of ['001-foundation.sql','002-authorization.sql','003-contract-evidence.sql','004-drafts.sql','005-approved-delivery.sql','006-run-history.sql','007-tracing.sql'])await db.exec(await readFile(new URL('../database/'+file,import.meta.url),'utf8'));
 await db.exec('SET ROLE dex_runtime');
 const store=new PostgresOperationsStore({connect:async()=>({
  query:async(text,values)=>{const result=await db.query(text,values);return {...result,rowCount:result.rows.length};},release:()=>{}
 })});
 const identity={userId:'agent-a',agencyId:'agency-a'};
 const findings=await store.attention(identity,'group-a');
 const sources=await store.contractSources(identity,'group-a');
 console.log(JSON.stringify({
  demo:'Dex Operations — local evidence milestone',
  storage:'Ephemeral PostgreSQL WASM engine (PGlite)',
  retrievalMode:'Strict fixture evidence; no semantic search or LLM calls',
  findings,deadlines:['payment','documents'].map(obligation=>resolveDeadline(sources,obligation)),
  inaccessibleGroup:await store.attention(identity,'group-b'),
  deliveryEnabled:false
 },null,2));
}finally{await db.close();}
