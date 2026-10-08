import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {context,sql,q,j,boundary,save,loadWork} from './implementation-context.mjs';
import {prepare,decide} from './proof-fixtures.mjs';
const c=await context(),f=JSON.parse(readFileSync(process.argv[2])).scenarios[0],db=boundary(),results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,'-');
function run(text){return new Promise(resolve=>{const p=spawn('docker',['exec','-i',db,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.once('exit',code=>resolve({code,out,err}));p.stdin.end(text);});}
try{
 for(const first of ['fact','acceptance']){
  const p=await prepare(c,f);await decide(c,f,p.work,'verify-quality');const before=await loadWork(p.owner,f,p.work);
  const fact=`insert into d5o_work_facts(workspace_id,work_id,fact_key,fact_revision,fact_type,value,scope_key,actor_profile_id,provenance) values(${q(f.workspace)},${q(p.work)},'certification_result',2,'verification','"failed"','package',${q(f.actors.performer.profile)},'{"synthetic":true,"source":"concurrent-nonconformance-fixture"}');`;
  const acceptance=`set local role authenticated;set local request.jwt.claim.sub=${q(f.actors.owner_acceptor.id)};set local request.jwt.claim.role='authenticated';select d5o_execute_work_command_v1(${q(f.workspace)},${q(p.work)},${before.work.record_version},1,${q(randomUUID())},'decide',${j({rightKey:'accept-turnover',reason:'Concurrent acceptance test'})});`;
  const a=run(`set application_name='m1-concurrency-first';begin;select pg_advisory_xact_lock(hashtextextended('d5o-m1:'||${q(f.workspace)},0));${first==='fact'?fact:acceptance}select pg_sleep(8);commit;`);
  // Observe the first session's actual held lock before dispatching the competing writer.
  let locked=false;for(let i=0;i<20;i++){const n=sql("select count(*) from pg_stat_activity where datname='postgres' and pid<>pg_backend_pid() and wait_event='PgSleep' and application_name='m1-concurrency-first';");if(Number(n)>0){locked=true;break;}await new Promise(r=>setTimeout(r,30));}if(!locked){const early=await a;throw Error('first transaction not observed: '+JSON.stringify(early));}
  const b=run(`begin;${first==='fact'?acceptance:fact}commit;`);const [one,two]=await Promise.all([a,b]);assert.equal(one.code,0,one.err);
  const after=await loadWork(p.owner,f,p.work);
  if(first==='fact'){assert.notEqual(two.code,0);assert.match(two.err,/concurrency_conflict|proof_revision_stale/);assert.equal(after.decisions.length,1);assert.notEqual(after.work.lifecycle_state,'accepted');}
  else{assert.equal(two.code,0,two.err);assert.equal(after.decisions.length,2);assert.equal(after.work.lifecycle_state,'accepted');const decision=after.decisions.find(x=>x.outcome_key===f.pack.rights.find(r=>r.key==='accept-turnover').outcomeKey);assert(decision);assert(after.blockers.some(x=>x.reason==='proof_revision_stale'));}
  results.push({name:first+' wins serialized race',status:'PASS',first:one.code,second:two.code});
 }
 save('CONCURRENT-INVALIDATION-'+tag+'.json',{status:'PASS',results});console.log(JSON.stringify({pass:results.length,results}));
}catch(e){save('CONCURRENT-INVALIDATION-'+tag+'.json',{status:'FAIL',error:e.message,results});console.error(e.message);process.exitCode=1;}
