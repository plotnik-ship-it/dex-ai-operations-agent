import { pipeline, env } from '@huggingface/transformers';
import {resolve} from 'node:path';
env.cacheDir=resolve('.cache/models');
export const EMBEDDING_MODEL='Xenova/all-MiniLM-L6-v2:q8';
export interface Embedder { embed(text:string):Promise<number[]> }
let extractor:Promise<any>|undefined;
export class LocalEmbedder implements Embedder {
 async embed(text:string):Promise<number[]> {
  if(text.length>4000)throw new Error('Embedding input exceeds limit');
  extractor??=pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'});
  const model=await extractor;
  const result=await model(text,{pooling:'mean',normalize:true});
  const values=Array.from(result.data as Float32Array);
  if(values.length!==384 || values.some(v=>!Number.isFinite(v)))throw new Error('Invalid embedding');
  return values;
 }
}
