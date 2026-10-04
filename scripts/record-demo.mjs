import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {setTimeout as sleep} from 'node:timers/promises';
import {resolve,join,dirname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('docs/demo');
await mkdir(root,{recursive:true});
const session='dex-portfolio-video';
process.env.AGENT_BROWSER_DEFAULT_TIMEOUT='120000';
const launcher=process.platform==='win32'?'npx.cmd':'npx';
function execute(command,args,timeout=150000){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{shell:false,windowsHide:true,env:process.env,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const timer=setTimeout(()=>{child.kill();reject(Error('Command timed out'));},timeout);
  child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);setTimeout(()=>{child.stdout.destroy();child.stderr.destroy();code===0?resolve(stdout):reject(Error(command+' failed: '+stderr+' '+stdout));},50);});
 });
}
async function ab(...args){
 if(process.env.AGENT_BROWSER_BIN)return execute(process.env.AGENT_BROWSER_BIN,['--session',session,...args]);
 // Windows uses explicit PowerShell argument serialization: no shell-interpreted JS or captions.
 if(process.platform==='win32'){
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  const command='& npx.cmd --yes agent-browser@0.38.2 --session '+quote(session)+' '+args.map(quote).join(' ');
  return execute('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')]);
 }
 return execute(launcher,['--yes','agent-browser@0.38.2','--session',session,...args]);
}
async function evaluate(js){
 const raw=JSON.parse(await ab('eval',js,'--json'));assert.equal(raw.success,true);
 return typeof raw.data.result==='string'?JSON.parse(raw.data.result):raw.data.result;
}
let trace;
const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function viewer(){
 const usage=trace.run.model_usage,events=trace.events;
 const selected=events.filter(e=>e.type==='tool_selected');
 const permissions=events.filter(e=>e.type==='permission_check');
 return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Dex — Trace inspection</title><style>body{margin:0;background:#f6f7f2;color:#193d32;font:18px Arial}header{padding:18px 42px;background:#193d32;color:white;display:flex;justify-content:space-between}main{max-width:1160px;margin:auto;padding:25px}h1{font-size:36px;margin:8px 0}h2{font-size:23px}p{line-height:1.5}small{font-size:13px;color:#65776f}code{font-size:14px}table{width:100%;border-collapse:collapse;background:white}td,th{padding:15px;border-bottom:1px solid #dae1d9;text-align:left}pre{font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere;background:#eef2e9;padding:16px}.metrics{display:flex;gap:14px;margin:20px 0}.metrics span,.tag{background:#e4ecd9;border-radius:8px;padding:12px}.panel{padding:18px;background:white;border:1px solid #dae1d9;border-radius:12px;margin:14px 0}.checks{display:flex;gap:8px;flex-wrap:wrap;font-size:14px}.checks span{background:#edf3e6;padding:9px;border-radius:8px}details{margin:7px 0;padding:12px;border:1px solid #d6ddd3;border-radius:8px}summary{cursor:pointer}.event-meta{font-size:12px;color:#65776f}</style><header><strong>dex. / TRACE INSPECTION</strong><span>Recording companion · Actual API snapshot</span></header><main><small>ONE REQUEST. ONE TRACE.</small><h1>From model proposal to approved delivery.</h1><p><code>'+escape(trace.traceId)+'</code><br>Northstar Demo Travel · Synthetic data · Local Mailpit</p><div class="metrics"><span>'+escape(usage.model)+'</span><span>'+usage.calls+' model calls</span><span>'+(usage.inputTokens+usage.outputTokens)+' tokens</span><span>Provider cost USD 0</span><span>'+events.length+' events</span></div><h2>Validated tool selection</h2><table><tr><th>Tool</th><th>Validated arguments</th></tr>'+selected.map(e=>'<tr><td><code>'+escape(e.data.tool)+'</code></td><td><code>'+escape(JSON.stringify(e.data.arguments))+'</code></td></tr>').join('')+'</table><section id="permissions" class="panel"><h2>Permission boundaries</h2><div class="checks">'+permissions.map(e=>'<span>'+escape(e.data.boundary)+' · '+(e.data.allowed?'ALLOWED':'DENIED')+'</span>').join('')+'</div></section><section id="delivery" class="panel"><h2>Human approval → durable job → test delivery</h2><p>Status: <strong>'+escape(trace.delivery.status)+'</strong> · Automatic retries: 0<br>Draft <code>'+escape(trace.run.draft_id)+'</code><br>Job <code>'+escape(trace.delivery.id)+'</code></p><small>Approval is bound to the reviewed payload. The worker rechecks authority and current data.</small></section><section id="events"><h2>Complete event stream · '+events.length+' events</h2><p>Ordered by database sequence. Open any event for its captured data.</p>'+events.map(e=>'<details><summary><strong>'+escape(e.sequence)+' · '+escape(e.type)+'</strong> '+(e.durationMs===null?'':e.durationMs+' ms')+'</summary><p class="event-meta">'+escape(e.timestamp)+'<br>Span '+escape(e.spanId)+'<br>Parent '+escape(e.parentSpanId??'root')+'</p><pre>'+escape(JSON.stringify(e.data,null,2))+'</pre></details>').join('')+'</section><section id="evidence" class="panel"><h2>Reliability evidence, reported separately</h2><p>98 passing test cases · 60 system scenarios included<br>8/8 selected Qwen cases · 4/4 adversarial cases</p><small>These are synthetic regression suites, not a claim of universal model accuracy.<br>No paid inference, GroupDeck connection or AWS deployment.</small></section></main></html>';
}
const server=createServer((_req,res)=>{if(!trace){res.writeHead(503);res.end('Trace not ready');return;}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(viewer());});
await new Promise(resolve=>server.listen(8091,'127.0.0.1',resolve));
const marks=[];
let started,recording=false;
async function at(seconds){const remaining=seconds*1000-(Date.now()-started);if(remaining>0)await sleep(remaining);}
function mark(scene){marks.push({scene,seconds:(Date.now()-started)/1000});console.log(JSON.stringify(marks.at(-1)));}
try{
 await ab('open','http://localhost:3000');await ab('set','viewport','1280','800');
 let snap=await ab('snapshot','-i');
 if(snap.includes('Enter demo workspace')){const ref=snap.match(/button "Enter demo workspace[^"]*" \[ref=(e\d+)\]/)?.[1];assert.ok(ref);await ab('click','@'+ref);}
 await ab('eval',"sessionStorage.removeItem('dex-draft')");await ab('reload');
 await ab('fill','#request','Find unpaid bookings with missing documents, check the contract deadlines, and prepare reminders for human review.');
 await ab('eval','window.scrollTo(0,120)');
 await ab('record','start','docs/demo/raw.webm','--fps','5');
 recording=true;started=Date.now();mark('problem');
 await at(8);mark('request');await ab('snapshot','-i');
 await ab('find','role','button','click','--name','Prepare reminders →');
 await ab('wait','--text','Messages to review');
 await at(32);mark('evidence');await ab('eval',"document.querySelector('.review-heading').scrollIntoView({block:'start'})");
 await at(marks.at(-1).seconds+12);mark('tools');await ab('snapshot','-i');await ab('click','.run-row:first-of-type summary');await ab('eval',"document.querySelector('.run-history').scrollIntoView({block:'start'})");
 const review=await evaluate("(async()=>{const id=sessionStorage.getItem('dex-draft');return JSON.stringify(await fetch('/drafts/'+id).then(r=>r.json()));})()");
 assert.equal(review.payload.plannerMode,'ollama-local');
 await at(marks.at(-1).seconds+13);mark('approval');await ab('eval',"document.querySelector('.approval').scrollIntoView({block:'start'})");await ab('snapshot','-i');await ab('check','input[type=checkbox]');
 await at(marks.at(-1).seconds+5);await ab('find','role','button','click','--name','Approve & queue delivery');await ab('wait','--text','Delivered to the local test inbox.');
 trace=await evaluate("(async()=>{return JSON.stringify(await fetch('/groups/group-a/runs/"+review.payload.runId+"/trace').then(r=>r.json()));})()");
 assert.equal(trace.delivery.status,'sent');assert.equal(trace.traceId,review.payload.runId);
 await writeFile(join(root,'recorded-trace.json'),JSON.stringify(trace,null,2)+'\n');
 await writeFile(join(root,'trace-inspection.html'),viewer());
 await at(marks.at(-1).seconds+13);mark('inbox');await ab('open','http://localhost:8025');const inbox=await ab('snapshot','-i');
 const message=inbox.split('\n').find(line=>line.includes('Action needed for your booking booking-a1')&&line.includes('[ref='));
 assert.ok(message,'Delivered message must exist');const messageRef=message.match(/\[ref=(e\d+)\]/)[1];await ab('click','@'+messageRef);
 await at(marks.at(-1).seconds+11);mark('trace');await ab('open','http://127.0.0.1:8091');
 await at(marks.at(-1).seconds+13);mark('events');await ab('scrollintoview','#events');await ab('click','#events details:first-of-type summary');
 await at(marks.at(-1).seconds+8);mark('reliability');await ab('scrollintoview','#evidence');
 await at(marks.at(-1).seconds+9);await ab('record','stop');recording=false;
 const metadata={recordedAt:new Date().toISOString(),traceId:trace.traceId,plannerMode:trace.run.planner_mode,model:trace.run.model_usage.model,deliveryStatus:trace.delivery.status,eventCount:trace.events.length,marks,source:'Continuous local browser recording through agent-browser 0.38.2. Trace inspection is a separately labeled snapshot viewer, not an added product feature.',audio:'No voiceover; English burned-in captions will be added.'};
 await writeFile(join(root,'recording.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log(JSON.stringify(metadata,null,2));
}finally{if(recording)try{await ab('record','stop');}catch{}server.close();}
