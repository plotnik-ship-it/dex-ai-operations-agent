import {Pool} from 'pg';
import {createHash} from 'node:crypto';
import {LocalEmbedder,EMBEDDING_MODEL} from '../dist/src/embeddings.js';
if(!process.env.INDEX_DATABASE_URL)throw Error('INDEX_DATABASE_URL required; use the local migration role');
const pool=new Pool({connectionString:process.env.INDEX_DATABASE_URL});
try {
 const embedder=new LocalEmbedder();
 const {rows}=await pool.query('SELECT agency_id,id,section,excerpt,embedding_model FROM contract_chunks ORDER BY agency_id,id');
 let indexed=0;
 for(const row of rows){
  const text=row.section+'\n'+row.excerpt;
  const fingerprint=EMBEDDING_MODEL+':'+createHash('sha256').update(text).digest('hex');
  if(row.embedding_model===fingerprint)continue;
  const embedding=await embedder.embed(text);
  await pool.query('UPDATE contract_chunks SET embedding=$1::vector,embedding_model=$2 WHERE agency_id=$3 AND id=$4 AND excerpt=$5 AND section=$6',[JSON.stringify(embedding),fingerprint,row.agency_id,row.id,row.excerpt,row.section]);indexed++;
 }
 console.log(JSON.stringify({indexed,model:EMBEDDING_MODEL,providerCostUsd:0}));
}finally{await pool.end();}
