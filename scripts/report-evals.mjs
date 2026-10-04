import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const paths={matrix:'docs/evals/evaluation-matrix.json',security:'docs/evals/security-tests.json',model:'docs/evals/model-matrix.json',adversarial:'docs/evals/adversarial-llm.json'};
const evidence={};
for(const [name,path] of Object.entries(paths)){
 try{const raw=await readFile(path,'utf8');evidence[name]={path,sha256:createHash('sha256').update(raw).digest('hex'),report:JSON.parse(raw)};}
 catch(error){if(error.code!=='ENOENT')throw error;evidence[name]={path,missing:true};}
}
let revision=null;try{revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const {report:matrix}=evidence.matrix,{report:security}=evidence.security,{report:model}=evidence.model,{report:adversarial}=evidence.adversarial;
const generatedAt=new Date().toISOString();
const fingerprint=createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(evidence).map(([key,value])=>[key,value.sha256??'missing'])))).digest('hex');
const version=(matrix?.evaluatedAt||generatedAt).slice(0,10)+'-'+fingerprint.slice(0,12);
const safety=adversarial?.results.filter(r=>r.safetyPassed).length,quality=adversarial?.results.filter(r=>r.qualityPassed).length;
const summary={generatedAt,version,revision,node:process.version,workflowRunId:process.env.GITHUB_RUN_ID??null,scope:'Evidence snapshot: each layer retains its actual evaluation date. Historical evidence is not a measurement from this workflow run.',evidence};
const layers=[
 ['System contracts + SQL engine',matrix?matrix.passedCount+'/'+matrix.scenarioCount:'Not run',matrix?.evaluatedAt??'—','No model calls',matrix?.complete&&matrix?.passed?'PASS':'NOT VERIFIED','../evals/evaluation-matrix.json'],
 ['Full local integration + security',security?security.testCases+' cases; '+security.failures+' failures; '+security.skipped+' skips':'Not run',security?.evaluatedAt??'—','Injected provider faults',security?.passed&&security?.skipped===0?'PASS':'NOT VERIFIED','../evals/security-tests.json'],
 ['Live model subset',model?model.passedCount+'/'+model.total:'Not run',model?.evaluatedAt??'—',model?.model??'—',model?.complete&&model?.passedCount===model?.total?'PASS':'NOT VERIFIED','../evals/model-matrix.json'],
 ['Adversarial model evidence',adversarial?safety+'/'+adversarial.results.length+' safety; '+quality+'/'+adversarial.results.length+' quality':'Not run',adversarial?.evaluatedAt??'—',adversarial?.results[0]?.usage?.model??'—',adversarial?.complete&&adversarial?.results.every(r=>r.safetyPassed&&r.qualityPassed)?'PASS':'NOT VERIFIED','../evals/adversarial-llm.json']
];
const doc=[
 '# Latest evaluation evidence','',
 'Generated: '+generatedAt+'  ',
 'Source revision at report generation: '+(revision??'uncommitted checkout; no HEAD available')+'  ',
 'Node: '+process.version+'  ',
 'Workflow run: '+(process.env.GITHUB_RUN_ID??'local execution'),'',
 'Evidence version: '+version+' ([preserved snapshot](history/'+version+'.md)).','',
 'Dates below belong to the actual evaluations. Model evidence may come from a separate run; check its workflow artifact and timestamp. Workflow configuration alone is not evidence of a hosted Actions run.','',
 '| Layer | Result | Evaluated at (UTC) | Model / method | Status | Evidence |',
 '| --- | --- | --- | --- | --- | --- |',
 ...layers.map(([layer,result,date,method,status,path])=>'| '+[layer,result,date,method,status,'[JSON]('+path+')'].join(' | ')+' |'),'',
 '## Scope and interpretation','',
 '- The 60 matrix scenarios are included in the full suite, not added to its count. Node counts parent tests separately: '+(security?.tests??'unknown')+' entries versus '+(security?.testCases??'unknown')+' JUnit leaf cases.',
 '- Fixture proposals test execution invariants, not LLM selection accuracy.',
 '- Live subset: Qwen/Ollama, schema-constrained proposals and controlled tools; '+(model?.repetitions??'unknown')+' repetition(s). No approval, SMTP or live semantic ranking in that subset.',
 '- Full integration: local PostgreSQL, pgvector and Mailpit, including concurrent approval/worker checks.',
 '- Adversarial evidence separates safety from quality. Missing/conflicting clauses require abstention.',
 '- Local provider cost is USD 0, excluding hardware/electricity and potential GitHub-hosted runner charges. No paid LLM or AWS deployment.','',
 '## Reproduce','',
 '~~~sh','npm ci','npm run eval:matrix','# Start/index local services; stop the demo worker before integration tests.','npm run test:security','# With Ollama and qwen3:4b available:','npm run eval:model-matrix','npm run eval:adversarial','npm run report:evals','~~~','',
 'Push/PR Actions run the full suite and matrix. Weekly/manual Actions run live-model and adversarial evals. Job summaries and artifacts expose evidence; workflows never push reports back to the repository.','',
 'Original report contents and SHA-256 hashes: [latest.json](latest.json). [Matrix definitions and limits](../evaluations.md) · [Tracing](../tracing.md).',''
].join('\n');
await mkdir('docs/eval-results/history',{recursive:true});
const archivedDoc=doc.replaceAll('(../evals/','(../../evals/').replaceAll('(latest.json)','('+version+'.json)').replaceAll('(../evaluations.md)','(../../evaluations.md)').replaceAll('(../tracing.md)','(../../tracing.md)').replaceAll('(history/'+version+'.md)','('+version+'.md)');
for(const [extension,content] of [['md',archivedDoc],['json',JSON.stringify(summary,null,2)+'\n']]){
 try{await writeFile('docs/eval-results/history/'+version+'.'+extension,content,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
}
await writeFile('docs/eval-results/latest.md',doc);
await writeFile('docs/eval-results/latest.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({generatedAt,revision,layers:layers.map(([layer,result,,,status])=>({layer,result,status}))},null,2));
