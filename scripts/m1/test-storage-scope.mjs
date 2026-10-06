import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {context,sql,q,save,rpc,loadWork} from './implementation-context.mjs';
import {prepare} from './proof-fixtures.mjs';
const plan=JSON.parse(readFileSync(process.argv[2])),c=await context(),f=plan.scenarios[0],other=plan.scenarios[1],results=[],tag=new Date().toISOString().replaceAll(/[:.]/g,'-');
try{
 const p=await prepare(c,f),foreign=await c.login(other.actors.preparer.email),object=JSON.parse(sql(`select to_jsonb(x) from evidence_objects x where id=${q(p.objects[0].id)};`));
 for(const [name,client] of [['anonymous',c.anon],['other workspace',foreign]]){
 const rows=await client.from('evidence_objects').select('id').eq('id',object.id);assert(rows.error||rows.data.length===0,name+' evidence metadata leak');
 const download=await client.storage.from(object.bucket_id).download(object.object_path);assert(download.error,name+' Storage read leak');
 const signed=await client.storage.from(object.bucket_id).createSignedUrl(object.object_path,60);assert(signed.error,name+' signed URL leak');
 await assert.rejects(()=>loadWork(client,f,p.work),/forbidden|permission|unauthenticated/);
 const histories=await client.from('audit_events').select('id').eq('entity_id',p.work);assert(histories.error||histories.data.length===0,name+' history leak');
 results.push({name:name+' cannot read work/evidence/Storage/history or sign evidence',status:'PASS'});
 }
 const denied=await foreign.rpc('create_evidence_download_grant_v1',{p_evidence_id:object.id});
 assert(!denied.error,'download grant RPC must resolve its supported signature');assert.equal(denied.data?.success,false);assert(['forbidden','not_found'].includes(denied.data?.error));results.push({name:'cross-workspace download grant denied',status:'PASS'});
 save('STORAGE-SCOPE-'+tag+'.json',{status:'PASS',results});console.log(JSON.stringify({results}));
}catch(e){save('STORAGE-SCOPE-'+tag+'.json',{status:'FAIL',error:e.message,results});console.error(e.message);process.exitCode=1;}
