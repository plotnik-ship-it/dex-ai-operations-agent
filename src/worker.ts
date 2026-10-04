import {Pool} from 'pg';
import {setTimeout} from 'node:timers/promises';
import {ApprovalService} from './approval.js';
import {MailpitTransport,processNextJob} from './delivery.js';
if(!process.env.DATABASE_URL || !process.env.WORKER_DATABASE_URL)throw Error('DATABASE_URL and WORKER_DATABASE_URL required');
const runtime=new Pool({connectionString:process.env.DATABASE_URL,max:2});
const queue=new Pool({connectionString:process.env.WORKER_DATABASE_URL,max:2});
let running=true;
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{running=false;});
try{do {
 const result=await processNextJob(queue,new ApprovalService(runtime),new MailpitTransport());
 if(result)console.info(JSON.stringify({service:'dex-worker',...result}));
 if(process.argv.includes('--once'))break;
 if(running)await setTimeout(1000);
}while(running);}finally{await runtime.end();await queue.end();}
