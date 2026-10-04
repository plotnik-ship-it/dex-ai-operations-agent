import {Pool} from 'pg';
import {createInterface} from 'node:readline/promises';
import {ApprovalService} from '../dist/src/approval.js';
const id=process.argv[2];
if(!id || !process.env.DATABASE_URL)throw Error('Usage: npm run review -- <draft-id>; DATABASE_URL is required');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const prompt=createInterface({input:process.stdin,output:process.stdout});
try {
 const service=new ApprovalService(pool);
 // Local demo identity. Hosted approval uses authenticated API identity.
 const identity={userId:'agent-a',agencyId:'agency-a'};
 const review=await service.review(identity,id);
 console.log(JSON.stringify(review,null,2));
 console.log('Delivery is restricted to demo@example.test in local Mailpit.');
 const answer=await prompt.question('Review the exact messages and sources above. Type APPROVE to queue delivery: ');
 if(answer==='APPROVE')console.log(JSON.stringify(await service.approve(identity,id,review.reviewHash),null,2));
 else console.log('Not approved. Nothing queued.');
}finally{prompt.close();await pool.end();}
