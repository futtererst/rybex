import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
export const root=process.cwd();
export const evidence=resolve(root,'artifacts/d5o-m1-s1-implementation-20260928T004316Z/baseline-correction-20260928T120032Z');
export const project='rybex-cfg03-q-m1-s1-recovery-20260928';
export const runtime=resolve(root,'.rybexos-local/m1-s1/brc-recovery');
export const db='supabase_db_'+project;
export const ids={workspace:'10000000-0000-4000-8000-000000000001',project:'30000000-0000-4000-8000-000000000001'};
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function sql(query){const inspect=spawnSync('docker',['inspect',db,'--format','{{index .Config.Labels "com.supabase.cli.project"}}'],{encoding:'utf8'});if(inspect.status!==0||inspect.stdout.trim()!==project)throw new Error('unowned_database');const p=spawnSync('docker',['exec','-i',db,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-X','-At'],{input:query,encoding:'utf8'});if(p.status!==0)throw new Error(p.stderr);return p.stdout.trim();}
export async function clients({bootstrap=false}={}){
 const keys=new Set(['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','PROGRAMFILES']);
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>keys.has(k.toUpperCase())));Object.assign(env,{SUPABASE_HOME:resolve(root,'.rybexos-local/m1-s1/cli-home'),SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1',CI:'1'});
 const result=spawnSync(resolve(root,'.rybexos-local/m1-s1/toolchain/supabase.exe'),['status','--workdir',runtime,'-o','env'],{env,encoding:'utf8'});if(result.status!==0)throw new Error('status_failed');
 const values=Object.fromEntries(result.stdout.split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
 if(values.API_URL!=='http://127.0.0.1:61421')throw new Error('wrong_endpoint');
 const password=readFileSync(resolve(root,'.rybexos-local/m1-s1/brc-test-password'),'utf8');
 Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:values.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:values.ANON_KEY,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:values.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:values.SERVICE_ROLE_KEY,SUPABASE_SECRET_KEY:values.SERVICE_ROLE_KEY,FOUNDATION_0A_TEST_PASSWORD:password,RYBEXOS_RUNTIME_MODE:'test',RYBEXOS_AUTH_MODE:'supabase',RYBEXOS_DATA_SOURCE:'database',RYBEX_QUALIFICATION_PROJECT_ID:project,RYBEX_QUALIFICATION_PROJECT_DIR:runtime,RYBEX_QUALIFICATION_DB_CONTAINER:db,FOUNDATION_0B_RESULTS_PATH:resolve(evidence,'raw/corrected-evidence-results.json')});
 if(bootstrap){const p=spawnSync(process.execPath,['scripts/bootstrap-foundation-0a-local.mjs'],{env,encoding:'utf8'});writeFileSync(resolve(evidence,'raw/recovery-bootstrap.json'),JSON.stringify({exit:p.status,stdout:p.stdout,stderr:p.stderr},null,2));if(p.status!==0)throw new Error('bootstrap_failed');}
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const service=createClient(values.API_URL,values.SERVICE_ROLE_KEY,options);
 async function login(email){const c=createClient(values.API_URL,values.ANON_KEY,options);const r=await c.auth.signInWithPassword({email,password});if(r.error)throw r.error;return c;}
 const field=await login('field-a@foundation0a.local');return {service,field,login,env,anon:createClient(values.API_URL,values.ANON_KEY,options)};
}
export async function upload(ctx,label='proof'){
 const bytes=Buffer.from('synthetic BRC evidence '+label+' '+randomUUID());const result=await ctx.field.rpc('create_evidence_upload_intent_v1',{p_entity_type:'field_issue',p_entity_id:ids.project,p_project_id:ids.project,p_original_filename:label+'.txt',p_mime_type:'text/plain'});if(result.error||!result.data?.success)throw new Error(JSON.stringify(result.error??result.data));
 const item={...result.data,bytes,checksum:hash(bytes)};const up=await ctx.field.storage.from(item.bucket).upload(item.objectPath,bytes,{contentType:'text/plain'});if(up.error)throw up.error;return item;
}
export async function receiptArgs(ctx,item,result='clean'){
 const info=await ctx.service.storage.from(item.bucket).info(item.objectPath);if(info.error)throw info.error;
 const downloaded=await ctx.service.storage.from(item.bucket).download(item.objectPath);if(downloaded.error)throw downloaded.error;
 const bytes=Buffer.from(await downloaded.data.arrayBuffer());if(hash(bytes)!==item.checksum)throw new Error('bytes_mismatch');const actor=await ctx.field.auth.getUser();
 return {p_evidence_id:item.evidenceId,p_workspace_id:ids.workspace,p_project_id:ids.project,p_requested_by:actor.data.user.id,p_storage_object_id:info.data.id,p_bucket_id:item.bucket,p_object_path:item.objectPath,p_storage_version:info.data.version,p_storage_updated_at:info.data.lastModified??info.data.updatedAt,p_sha256:item.checksum,p_size_bytes:item.bytes.length,p_scanner:'synthetic-byte-verified-brc-fixture',p_result:result,p_scanned_at:new Date().toISOString(),p_expected_version:1,p_correlation_id:'brc-fixture',p_receipt_key:randomUUID()};
}
export function finalizeArgs(item,command=randomUUID()){return {p_evidence_id:item.evidenceId,p_entity_type:'field_issue',p_entity_id:ids.project,p_relationship_type:'supporting_evidence',p_size_bytes:item.bytes.length,p_checksum_sha256:item.checksum,p_expected_version:1,p_command_id:command,p_correlation_id:'brc-proof'};}
