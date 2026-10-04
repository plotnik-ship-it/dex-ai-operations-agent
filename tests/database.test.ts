import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { PostgresOperationsStore } from '../src/store.js';
test('real PostgreSQL: RLS, group scope, revoked membership and pooled context',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:1});
 const store=new PostgresOperationsStore(pool);
 try {
  const role=await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  assert.equal(role.rows[0].rolsuper,false);assert.equal(role.rows[0].rolbypassrls,false);
  const agent={userId:'agent-a',agencyId:'agency-a'};
  assert.deepEqual((await store.attention(agent,'group-a'))?.map(b=>b.id),['booking-a1']);
  assert.equal(await store.attention(agent,'group-b'),null);
  assert.deepEqual((await store.contractSources(agent,'group-a'))?.map(s=>s.id),['documents-a','payment-a']);
  assert.equal(await store.contractSources(agent,'group-b'),null);
  assert.equal(await store.contractSources(agent,'group-a-private'),null);
  assert.equal(await store.attention(agent,'group-a-private'),null);
  assert.equal(await store.attention({userId:'agent-a',agencyId:'agency-b'},'group-b'),null);
  assert.equal(await store.attention({userId:'revoked-a',agencyId:'agency-a'},'group-a'),null);
  assert.deepEqual((await store.attention({userId:'owner-a',agencyId:'agency-a'},'group-a-private'))?.map(b=>b.id),['booking-a-private']);
  assert.deepEqual((await store.attention({userId:'owner-b',agencyId:'agency-b'},'group-b'))?.map(b=>b.id),['booking-b1']);
  assert.equal((await pool.query('SELECT * FROM bookings')).rowCount,0);
  assert.deepEqual((await store.attention(agent,'group-a'))?.map(b=>b.id),['booking-a1']);
 }finally{await pool.end();}
});
