import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsAttention, remainingMinor, type Booking, type Scope } from '../src/domain.js';
const booking: Booking = { id:'booking-a1',agencyId:'agency-a',groupId:'group-a',totalMinor:200000,paidMinor:50000,currency:'USD',missingDocuments:['passport_copy'],status:'active' };
const scope: Scope = {userId:'agent-a',agencyId:'agency-a',role:'agent',groupIds:['group-a']};
test('requires both a balance and missing documents',()=>{
 assert.equal(needsAttention(booking,scope),true);
 assert.equal(needsAttention({...booking,paidMinor:200000},scope),false);
 assert.equal(needsAttention({...booking,missingDocuments:[]},scope),false);
 assert.equal(needsAttention({...booking,status:'cancelled'},scope),false);
});
test('denies other agencies and unassigned groups',()=>{
 assert.equal(needsAttention({...booking,agencyId:'agency-b'},scope),false);
 assert.equal(needsAttention({...booking,groupId:'group-b'},scope),false);
 assert.equal(needsAttention({...booking,agencyId:'agency-b'},{...scope,role:'owner'}),false);
});
test('money uses integer minor units',()=>{
 assert.equal(remainingMinor(booking),150000);
 assert.equal(remainingMinor({...booking,paidMinor:250000}),0);
 assert.throws(()=>remainingMinor({...booking,totalMinor:1.5}));
});
