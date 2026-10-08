import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {context,evidence,hash,boundary} from './implementation-context.mjs';
import {runMigrations} from './migration-runner.mjs';
const suite=process.argv[2],cycles={cfg01:[24,25],cfg02:[26,27],cfg03:[28,29]};assert(cycles[suite],'explicit approved suite required');
const c=await context(),tag=new Date().toISOString().replaceAll(/[:.]/g,'-'),out=resolve(evidence,'isolated-'+suite+'-'+tag),priv=resolve('.rybexos-local/m1-s1','isolated-'+suite+'-'+tag);mkdirSync(out);mkdirSync(priv);
const original=JSON.parse(readFileSync(resolve(evidence,'adoption-2026-09-28T23-24-25-581Z/GATE-MANIFEST.json'))),[a,b]=cycles[suite];
for(const n of [a,b])assert(!existsSync(resolve('artifacts/d5o-m1-s1-implementation-20260928T004316Z/replay-base-generation-20260928-01/runtime-lifecycle',`cycle-${n}-stop.json`)),'cycle_consumed');
const m={...original,evidence:out,private:priv,preparationCycle:`cycle-${a}`,allowedPhases:['reference'],runtimePhase:true},mp=resolve(out,'GATE-MANIFEST.json');writeFileSync(mp,JSON.stringify(m,null,2));process.env.M1_GATE_MODE='owned';process.env.M1_GATE_MANIFEST=mp;
const {ownedGateAdapter}=await import('./qualification/owned-gate-adapter.mjs');const adapter=ownedGateAdapter();
const env={...adapter.childEnv(c.env),M1_GATE_MANIFEST:mp,P1_CFG_REFERENCE_LIBRARY:'1',P1_CFG01_LIBRARY:'1',CFG_RUNTIME_03_EVIDENCE_NAMESPACE:relative(process.cwd(),out).replaceAll('\\','/'),CFG_RUNTIME_03_ACTIVE_ROOT:process.cwd(),P1_CFG_RESULT_PATH:resolve(out,'assertions.json')};
writeFileSync(resolve(out,'RUN-MANIFEST.json'),JSON.stringify({manifestSha256:hash(readFileSync(mp)),runnerSha256:hash(readFileSync('scripts/m1/test-isolated-reference.mjs')),project:m.project,api:m.api,db:env.RYBEX_QUALIFICATION_DB_CONTAINER,scope:'Reference suite on clean complete 34-migration replay; restore candidate and Storage afterward; original assertions unchanged'},null,2));
function run(label,args){const p=spawnSync(process.execPath,args,{env,encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024});writeFileSync(resolve(out,label+'.json'),JSON.stringify({exit:p.status,stdout:p.stdout,stderr:p.stderr},null,2));assert.equal(p.status,0,label+' failed');}
let scanner,prepared=false,started=false;const result={suite,status:'RUNNING'};
try{
 adapter.prepare();prepared=true;const target=await adapter.begin('reference');const replay=runMigrations(m,34,'complete');assert.equal(replay.applied,34);result.ledgerCount=replay.after.length;adapter.end(target);
 run('runtime-start',[m.lifecycle,'start',`cycle-${a}`]);started=true;run('bootstrap',['scripts/bootstrap-foundation-0a-local.mjs']);
 scanner=spawn(process.execPath,['scripts/local-foundation-0f-scanner-service.mjs','61428'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';scanner.stderr.on('data',x=>log+=x);
 await new Promise((yes,no)=>{const t=setTimeout(()=>no(Error('scanner timeout')),10000);scanner.once('exit',()=>{clearTimeout(t);no(Error('scanner exited'));});scanner.stdout.on('data',x=>{log+=x;if(log.includes('FOUNDATION_0F_SCANNER_READY 61428')){clearTimeout(t);yes();}});});
 const expression=suite==='cfg01'?`m.runRuntimeAssertions('${env.RYBEX_QUALIFICATION_DB_CONTAINER}')`:suite==='cfg02'?'m.runLocalBusinessProof()':'m.runOwnedReference(process.env)';
 run('reference',['--input-type=module','-e',`const m=await import('./scripts/verify-cfg-runtime-${suite.slice(-2)}-database.mjs');try{await ${expression};}finally{const {writeFileSync}=await import('node:fs');writeFileSync(process.env.P1_CFG_RESULT_PATH,JSON.stringify(m.referenceResults(),null,2));}`]);
 result.status='PASS';
}catch(e){result.status='FAIL';result.error=e.message;process.exitCode=1;}finally{
 if(scanner&&scanner.exitCode===null)scanner.kill();
 if(prepared){if(started){run('runtime-stop',[m.lifecycle,'stop',`cycle-${b}`]);const recovery={...m,preparationCycle:`cycle-${b}`},rp=resolve(out,'RECOVERY-MANIFEST.json');writeFileSync(rp,JSON.stringify(recovery,null,2));const p=spawnSync('python',['scripts/m1/qualification/owned-database-phase.py',rp,'recover'],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});writeFileSync(resolve(out,'recovery.json'),JSON.stringify({exit:p.status,stdout:p.stdout,stderr:p.stderr}));assert.equal(p.status,0,'candidate recovery failed');}else adapter.recover();result.candidateRestored=true;boundary();}
 writeFileSync(resolve(out,'RESULT.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:out}));
}
