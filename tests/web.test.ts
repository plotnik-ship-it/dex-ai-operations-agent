import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/app.js';
import {registerDemoWeb} from '../src/web.js';
test('local browser sessions require same origin, expire on logout and never expose the API token',async()=>{
 const token='private-test-server-token';
 const app=buildApp({attention:async()=>[]},header=>header==='Bearer '+token?{userId:'agent-a',agencyId:'agency-a'}:null);
 await registerDemoWeb(app,token,3000);
 try {
  assert.equal((await app.inject({method:'POST',url:'/demo/session',headers:{origin:'https://untrusted.example'},payload:{}})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/demo/session',payload:{}})).statusCode,403);
  const login=await app.inject({method:'POST',url:'/demo/session',headers:{origin:'http://localhost:3000'},payload:{}});
  assert.equal(login.statusCode,200);assert.ok(!login.body.includes(token));
  const cookie=String(login.headers['set-cookie']).split(';')[0]!;
  assert.match(String(login.headers['set-cookie']),/HttpOnly/);assert.match(String(login.headers['set-cookie']),/SameSite=Strict/i);
  assert.equal((await app.inject({url:'/groups/group-a/attention',headers:{cookie}})).statusCode,200);
  assert.equal((await app.inject({method:'DELETE',url:'/demo/session',headers:{cookie,origin:'https://untrusted.example'}})).statusCode,403);
  assert.equal((await app.inject({method:'DELETE',url:'/demo/session',headers:{cookie,origin:'http://localhost:3000'}})).statusCode,200);
  assert.equal((await app.inject({url:'/groups/group-a/attention',headers:{cookie}})).statusCode,401);
  const page=await app.inject('/');assert.equal(page.statusCode,200);assert.match(page.body,/Operations workspace/);assert.ok(page.headers['content-security-policy']);
 }finally{await app.close();}
});
