import {Pool} from 'pg';
import {PostgresOperationsStore} from '../dist/src/store.js';
import {LocalEmbedder} from '../dist/src/embeddings.js';
import {runReminderAgent,DemoPlanner} from '../dist/src/agent.js';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required; use dex_runtime');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try {
 const result=await runReminderAgent(new PostgresOperationsStore(pool),new LocalEmbedder(),new DemoPlanner(),{userId:'agent-a',agencyId:'agency-a'},'group-a','Find unpaid bookings with missing documents and prepare reminders.');
 console.log(JSON.stringify(result,null,2));
}finally{await pool.end();}
