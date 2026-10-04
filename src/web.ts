import type {FastifyInstance} from 'fastify';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
export async function registerDemoWeb(app:FastifyInstance,token:string,port:number){
 const origins=new Set(['http://localhost:'+port,'http://127.0.0.1:'+port]);
 const sessions=new Map<string,number>();
 await app.register(cookie);
 app.addHook('onRequest',async(req,reply)=>{
  const session=req.cookies.dex_session;
  const browserAuth=session && (sessions.get(session)??0)>Date.now();
  if((browserAuth || req.url==='/demo/session') && !['GET','HEAD'].includes(req.method) && !origins.has(req.headers.origin??''))return reply.code(403).send({error:'Same-origin request required'});
  if(browserAuth && !req.headers.authorization)req.headers.authorization='Bearer '+token;
 });
 app.post('/demo/session',async(_req,reply)=>{
  for(const [key,expires]of sessions)if(expires<=Date.now())sessions.delete(key);
  if(sessions.size>=20)return reply.code(429).send({error:'Too many demo sessions'});
  const id=randomBytes(32).toString('hex');sessions.set(id,Date.now()+3600000);
  reply.setCookie('dex_session',id,{httpOnly:true,sameSite:'strict',path:'/',maxAge:3600});
  return {user:'Demo agent',agency:'Northstar Demo Travel'};
 });
 app.delete('/demo/session',async(req,reply)=>{if(req.cookies.dex_session)sessions.delete(req.cookies.dex_session);reply.clearCookie('dex_session',{path:'/'});return {signedOut:true};});
 app.get('/demo/session',async(req,reply)=>{if(!req.cookies.dex_session || (sessions.get(req.cookies.dex_session)??0)<=Date.now())return reply.code(401).send({error:'Session required'});return {user:'Demo agent',agency:'Northstar Demo Travel'};});
 app.addHook('onSend',async(_req,reply,payload)=>{
  reply.header('X-Content-Type-Options','nosniff');
  reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  reply.header('Cache-Control','no-store');return payload;
 });
 await app.register(staticFiles,{root:resolve('dist/public'),prefix:'/'});
}
