import {spawnSync} from 'node:child_process';
import {context,save} from './implementation-context.mjs';
const {env}=await context();const tag=new Date().toISOString().replaceAll(/[:.]/g,'-');
for(const [name,args] of [['typecheck',['node_modules/typescript/bin/tsc','--noEmit']],['lint',['node_modules/eslint/bin/eslint.js','app','components','lib','scripts','proxy.ts','next.config.mjs','eslint.config.mjs']]]){const p=spawnSync(process.execPath,args,{env,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});save(`${name}-${tag}.json`,{exit:p.status,stdout:p.stdout,stderr:p.stderr});console.log(name,p.status);if(p.status!==0){process.exitCode=1;break;}}
