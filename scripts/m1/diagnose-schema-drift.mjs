import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {boundary,hash,manifest,evidence} from './implementation-context.mjs';
const tag=new Date().toISOString().replaceAll(/[:.]/g,'-'),out=resolve(evidence,'schema-diagnosis-'+tag),priv=resolve('.rybexos-local/m1-s1','schema-diagnosis-'+tag);
const previous=resolve(evidence,'replay-2026-09-28T22-33-41-006Z/GATE-MANIFEST.json');const m=JSON.parse(readFileSync(previous));
for(const x of JSON.parse(readFileSync(resolve(evidence,'CANDIDATE-SOURCE-MANIFEST.json'))))assert.equal(hash(readFileSync(x.path)),x.sha256,x.path);
for(const x of m.replay)assert.equal(hash(readFileSync(x.path)),x.sha256,x.path);
assert(!existsSync(resolve('artifacts/d5o-m1-s1-implementation-20260928T004316Z/replay-base-generation-20260928-01/runtime-lifecycle/cycle-19-stop.json')));
mkdirSync(out);mkdirSync(priv);Object.assign(m,{evidence:out,private:priv,preparationCycle:'cycle-19',allowedPhases:['diagnostic-fresh'],runtimePhase:false});
const path=resolve(out,'GATE-MANIFEST.json');writeFileSync(path,JSON.stringify(m,null,2));writeFileSync(resolve(out,'AUTHORITY.json'),JSON.stringify({user:'proceed. Address the blocker at the root cause',scope:'One diagnostic replay, complete schema capture, exact comparison and candidate recovery; no repair',manifestSha256:hash(readFileSync(path)),scriptSha256:hash(readFileSync('scripts/m1/diagnose-schema-drift.mjs'))},null,2));
process.env.M1_GATE_MODE='owned';process.env.M1_GATE_MANIFEST=path;const {ownedGateAdapter}=await import('./qualification/owned-gate-adapter.mjs');const adapter=ownedGateAdapter(),db=boundary();
function capture(label){const p=spawnSync('docker',['exec',db,'pg_dump','-U','postgres','-d','postgres','--schema-only'],{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});assert.equal(p.status,0);const normalized=p.stdout.replaceAll('\r\n','\n').replace(/^\\(?:un)?restrict .*$/gm,'');writeFileSync(resolve(priv,label+'.sql'),p.stdout);writeFileSync(resolve(priv,label+'-normalized.sql'),normalized);return {rawSha256:hash(p.stdout),normalizedSha256:hash(normalized),bytes:Buffer.byteLength(p.stdout)};}
let prepared=false;const result={};try{result.upgraded=capture('upgraded');adapter.prepare();prepared=true;const target=await adapter.begin('diagnostic-fresh');adapter.apply(db,1,34);result.fresh=capture('fresh');result.exactMatch=result.upgraded.normalizedSha256===result.fresh.normalizedSha256;adapter.end(target);}finally{if(prepared){adapter.recover();result.recovered=capture('recovered');result.candidateRestored=result.upgraded.normalizedSha256===result.recovered.normalizedSha256;}writeFileSync(resolve(out,'CAPTURES.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify({evidence:out,private:priv,...result}));

