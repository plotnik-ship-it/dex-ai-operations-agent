import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { demoAuthenticator } from '../src/auth.js';
const token='test-only-token-at-least-24-characters';
test('authentication, server identity, denied group and validated input',async()=>{
 const calls:unknown[]=[];
 const app=buildApp({async attention(identity,groupId){calls.push(identity);return groupId==='group-a'?[{id:'booking-a1',groupId,balanceMinor:'150000',currency:'USD',missingDocuments:['passport_copy']}]:null;}},demoAuthenticator([{userId:'agent-a',agencyId:'agency-a',token}]));
 try {
  assert.equal((await app.inject('/groups/group-a/attention')).statusCode,401);
  assert.equal(calls.length,0);
  const headers={authorization:'Bearer '+token};
  const allowed=await app.inject({url:'/groups/group-a/attention',headers});
  assert.equal(allowed.statusCode,200);
  assert.equal(allowed.json().findings[0].balanceMinor,'150000');
  assert.deepEqual(calls[0],{userId:'agent-a',agencyId:'agency-a'});
  assert.equal((await app.inject({url:'/groups/group-b/attention',headers})).statusCode,404);
  assert.equal((await app.inject({url:'/groups/group-a/attention?agencyId=agency-b',headers})).statusCode,400);
 }finally{await app.close();}
});
test('invalid credentials do not authenticate',()=>{
 const auth=demoAuthenticator([{userId:'agent-a',agencyId:'agency-a',token}]);
 assert.equal(auth('Bearer invalid'),null);
 assert.equal(auth(undefined),null);
 assert.throws(()=>demoAuthenticator([{userId:'x',agencyId:'x',token:'short'}]));
});
