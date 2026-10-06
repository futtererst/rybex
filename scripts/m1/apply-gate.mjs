import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {boundary,sql,save,hash,evidence,manifest} from "./implementation-context.mjs";
import {runMigrations} from "./migration-runner.mjs";
import {rollbackOnly} from "./validate-migration-boundary.mjs";
const mode=process.argv[2];if(!["--rollback","--apply"].includes(mode))throw Error("explicit_mode_required");
const source=JSON.parse(readFileSync(manifest.source_manifest));
for(const x of source)if(hash(readFileSync(x.path))!==x.sha256)throw Error("admitted_source_drift:"+x.path);
for(const x of manifest.replay)if(hash(readFileSync(x.path))!==x.sha256)throw Error("replay_source_drift");
const path="supabase/migrations/20260928214119_d5o_m1_work_record_gate.sql",bytes=readFileSync(path);
const configs=["rybex","rotork"].map(n=>{const p=`config/template-packs/d5o-m1-proof-${n}-v1.json`;return {path:p,sha256:hash(readFileSync(p))};});
const tag=new Date().toISOString().replaceAll(/[:.]/g,"-");
const seal={mode,migration:{path,sha256:hash(bytes)},configurations:configs,project:manifest.project,ownership:manifest.ownership_sha256};save(`apply-${tag}-seal.json`,seal);
const db=boundary();function schema(){const p=spawnSync("docker",["exec",db,"pg_dump","-U","postgres","-d","postgres","--schema-only"],{encoding:"utf8",windowsHide:true,maxBuffer:12*1024*1024});if(p.status!==0)throw Error("schema_capture_failed");return hash(p.stdout.replaceAll("\r\n","\n").replace(/^\\(?:un)?restrict .*$/gm,""));}
const before=schema();let error=null;try{if(mode==="--rollback"){sql(rollbackOnly(bytes.toString("utf8")));}else{if(!process.argv[3])throw Error("explicit_owned_migration_manifest_required");const execution=JSON.parse(readFileSync(resolve(process.argv[3])));runMigrations(execution,34,"incremental-apply");}}catch(e){error=e.message;}
const after=schema();const restored=mode!=="--rollback"||before===after;save(`apply-${tag}-result.json`,{mode,error,before,after,rollbackRestored:restored});if(error||!restored)throw Error(error??"rollback_schema_drift");
console.log(JSON.stringify({mode,status:"PASS",schema:after,evidence:resolve(evidence,`apply-${tag}-result.json`)}));
