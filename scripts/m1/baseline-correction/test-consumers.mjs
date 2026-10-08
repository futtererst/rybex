import {spawnSync} from 'node:child_process';import {writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {clients,evidence,sql} from './fixtures.mjs';
const {env}=await clients();sql('select 1');const results=[];
for(const [file,key] of [['qa-foundation-0a-security.mjs','FOUNDATION_0A_RESULTS_PATH'],['qa-foundation-0b-command-security.mjs','FOUNDATION_0B_RESULTS_PATH'],['qa-foundation-0b-evidence-security.mjs','FOUNDATION_0B_RESULTS_PATH'],['qa-foundation-0c-billing-persistence.mjs','FOUNDATION_0C_RESULTS_PATH']]){
 const resultPath=resolve(evidence,'raw',file+'.results.json');const p=spawnSync(process.execPath,['scripts/'+file],{env:{...env,[key]:resultPath},encoding:'utf8',maxBuffer:8*1024*1024});
 writeFileSync(resolve(evidence,'raw',file+'.run.json'),JSON.stringify({command:`node scripts/${file}`,exit:p.status,stdout:p.stdout,stderr:p.stderr},null,2));results.push({file,status:p.status===0?'PASS':'FAIL',resultPath});writeFileSync(resolve(evidence,'raw/regression-results.json'),JSON.stringify({results},null,2));console.log(file,p.status===0?'PASS':'FAIL');if(p.status!==0){process.exitCode=1;break;}
}
