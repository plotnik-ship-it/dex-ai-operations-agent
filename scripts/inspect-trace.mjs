const traceId=process.argv[2];
const groupId=process.argv[3]||'group-a';
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(traceId||'')||!/^[a-zA-Z0-9_-]{1,128}$/.test(groupId))throw Error('Usage: npm run trace -- <trace UUID> [group ID]');
if(!process.env.DEMO_AGENT_TOKEN)throw Error('Demo token is required');
const response=await fetch('http://127.0.0.1:3000/groups/'+groupId+'/runs/'+traceId+'/trace',{headers:{authorization:'Bearer '+process.env.DEMO_AGENT_TOKEN},signal:AbortSignal.timeout(10000)});
if(!response.ok)throw Error('Trace request failed with HTTP '+response.status);
console.log(JSON.stringify(await response.json(),null,2));
