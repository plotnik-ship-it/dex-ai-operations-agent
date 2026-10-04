import {spawnSync} from 'node:child_process';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
// Always use the independent local demo services; never inherit remote database URLs.
const env={...process.env,TEST_DATABASE_URL:'postgres://dex_runtime:local_demo_password@localhost:5432/dex',INDEX_DATABASE_URL:'postgres://dex_migration:local_migration_password@localhost:5432/dex',WORKER_DATABASE_URL:'postgres://dex_worker:local_worker_password@localhost:5432/dex',SEMANTIC_EVAL:'true',DELIVERY_EVAL:'true'};
const files=(await readdir('dist/tests')).filter(f=>f.endsWith('.test.js')).map(f=>'dist/tests/'+f);
const started=new Date();
const run=spawnSync(process.execPath,['--test','--test-reporter=junit',...files],{env,encoding:'utf8',maxBuffer:10*1024*1024,timeout:180000});
await mkdir('docs/evals',{recursive:true});
const xml=(run.stdout||'').replaceAll(process.cwd(),'.');
await writeFile('docs/evals/security-tests.xml',xml);
const report={evaluatedAt:started.toISOString(),durationMs:Date.now()-started.getTime(),exitCode:run.status,signal:run.signal,passed:run.status===0,tests:Number(xml.match(/<!-- tests (\d+) -->/)?.[1]||0),testCases:(xml.match(/<testcase[ >]/g)||[]).length,failures:(xml.match(/<failure[ >]/g)||[]).length,skipped:(xml.match(/<skipped[ \/>]/g)||[]).length,scope:'All automated tests with local PostgreSQL, semantic retrieval and Mailpit; provider faults are injected test doubles',junit:'security-tests.xml'};
await writeFile('docs/evals/security-tests.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(run.status!==0){console.error(run.stderr||run.error?.message||'See the JUnit report for failures');process.exitCode=1;}
