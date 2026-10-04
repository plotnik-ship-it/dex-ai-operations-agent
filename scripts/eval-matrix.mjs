import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const matrixText=await readFile('fixtures/evaluation-matrix.json','utf8');
const matrix=JSON.parse(matrixText);
const started=Date.now();
const run=spawnSync(process.execPath,['--test','--test-reporter=junit','dist/tests/evaluation-matrix.test.js'],{encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
const xml=(run.stdout||'').replaceAll(process.cwd(),'.');
const cases=xml.match(/<testcase\b[^>]*(?:\/\s*>|>[\s\S]*?<\/testcase>)/g)||[];
const results=matrix.scenarios.map(s=>{
 const tag=cases.find(c=>c.includes('name="'+s.id+' '));
 const found=!!tag,passed=found&&!/<failure\b|<skipped\b/.test(tag);
 return {...s,passed,evidence:found?'evaluation-matrix.xml#'+s.id:null};
});
const categories=Object.fromEntries([...new Set(results.map(r=>r.category))].map(c=>[c,{total:results.filter(r=>r.category===c).length,passed:results.filter(r=>r.category===c&&r.passed).length}]));
let revision=null;try{revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const report={evaluatedAt:new Date().toISOString(),durationMs:Date.now()-started,complete:results.every(r=>r.evidence),passed:run.status===0&&results.every(r=>r.passed),exitCode:run.status,node:process.version,revision,matrixSha256:createHash('sha256').update(matrixText).digest('hex'),modelCalls:0,scope:'60 deterministic contract and SQL-engine scenarios. Fixture refusal proposals are not LLM classification accuracy. SQL uses PGlite and production migrations/adapters; not network/pool concurrency.',scenarioCount:results.length,passedCount:results.filter(r=>r.passed).length,categories,results};
await mkdir('docs/evals',{recursive:true});
await writeFile('docs/evals/evaluation-matrix.xml',xml);
await writeFile('docs/evals/evaluation-matrix.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,results:undefined},null,2));
if(!report.passed){console.error(run.stderr||run.error?.message||'Inspect the matrix JUnit report');process.exitCode=1;}
