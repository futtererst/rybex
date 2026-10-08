import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateSelection} from './migration-runner.mjs';
import {evidence} from './implementation-context.mjs';
const m=JSON.parse(readFileSync(resolve(evidence,'replay-2026-09-28T22-33-41-006Z/GATE-MANIFEST.json'))),results=[];
for(const [name,change,end] of [
 ['wrong project',x=>x.project='d5o-platform',34],['remote API',x=>x.api='https://excluded.invalid',34],['wrong root',x=>x.root='C:/excluded',34],['wrong ownership',x=>x.ownershipSha256='0',34],['missing migration',x=>x.replay.pop(),34],['wrong variant',x=>x.replay[15].source='0016_other.sql',34],['source hash drift',x=>x.replay[15].sha256='0',34],['source path drift',x=>x.replay[15].path='C:/excluded.sql',34],['duplicate source',x=>x.replay[33]=x.replay[32],34],['wrong staged version',x=>x.replay[15].staged_name='0015_collision.sql',34],['unsupported prefix',()=>{},32]]){const x=structuredClone(m);change(x);assert.throws(()=>validateSelection(x,end));results.push({name,status:'PASS',noDatabaseInvocation:true});}
assert.equal(validateSelection(m,33).length,33);assert.equal(validateSelection(m,34).length,34);results.push({name:'exact approved 33 and 34 selections admitted',status:'PASS'});
const output=resolve(evidence,'RUNNER-PREFLIGHT-'+new Date().toISOString().replaceAll(/[:.]/g,'-')+'.json');writeFileSync(output,JSON.stringify({status:'PASS',results},null,2));console.log(JSON.stringify({pass:results.length,output}));
