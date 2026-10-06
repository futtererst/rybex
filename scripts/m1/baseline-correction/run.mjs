import { createServer, request as httpRequest } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { identifyInitializationJob } from '../initialization-job-guard.mjs';
import { ensureLoopbackNetwork } from '../../local-supabase-loopback-network.mjs';

const root = resolve(process.cwd());
const evidence = resolve(root, 'artifacts/d5o-m1-s1-implementation-20260928T004316Z/baseline-correction-20260928T120032Z/provision');
const manifest = JSON.parse(readFileSync(resolve(evidence, 'RUN-MANIFEST.json'), 'utf8'));
if (root !== manifest.worktree || manifest.phase !== 'before-disposable-provision') throw new Error('Unsealed provisioning target');
const project = manifest.project_id;
if (project !== 'rybex-cfg03-q-m1-s1-recovery-20260928') throw new Error('Unexpected project');
const allowedPorts = new Set(Object.values(manifest.ports).map(String));
const runtime = manifest.runtime_directory;
const allowedKeys = new Set(['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','PROGRAMFILES']);
const env = Object.fromEntries(Object.entries(process.env).filter(([key])=>allowedKeys.has(key.toUpperCase())));
Object.assign(env, { SUPABASE_HOME:resolve(root,'.rybexos-local/m1-s1/cli-home'), SUPABASE_TELEMETRY_DISABLED:'1', DO_NOT_TRACK:'1', CI:'1', DOCKER_CONTEXT:'desktop-linux' });
const docker = (...args) => {
  const result=spawnSync('docker',args,{env,encoding:'utf8'});
  if(result.status!==0) throw new Error(`Docker inspection failed: ${args.slice(0,2).join(' ')}`);
  return result.stdout.trim();
};
if(docker('ps','-aq','--filter',`label=com.supabase.cli.project=${project}`)) throw new Error('Project collision');
for(const name of docker('volume','ls','-q','--filter',`label=com.supabase.cli.project=${project}`).split(/\r?\n/).filter(Boolean)) {
 const expected=manifest.owned_initial_volumes?.find(v=>v.Name===name);
 const actual=JSON.parse(docker('volume','inspect',name))[0];
 if(!expected || actual.CreatedAt!==expected.CreatedAt || actual.Labels?.['com.supabase.cli.project']!==project) throw new Error('Volume collision');
}
const priorNetwork=docker('network','ls','-q','--filter',`name=^${manifest.network_name}$`);
if(!priorNetwork || docker('network','inspect',manifest.network_name,'--format','{{.Id}}')!==manifest.owned_initial_network_id) throw new Error('Owned allocation changed');
const network=ensureLoopbackNetwork(project,{env});
const networkId=docker('network','inspect',network,'--format','{{.Id}}');
const ownedNetworks=new Set([network,networkId]);
const owned=new Map();
const initializationJobs=new Set();
const events=[{kind:'network',name:network,id:networkId}];
const plannedVolumes=new Set((manifest.owned_initial_volumes??[]).map(v=>v.Name));
let stopped=false;
const flush=()=>writeFileSync(resolve(evidence,'raw/provision-events.json'),JSON.stringify(events,null,2));
flush();
function deny(message) { stopped=true; events.push({kind:'STOP',message}); flush(); throw new Error(message); }
function checkMount(source) {
  if(source.endsWith(`_${project}`) && /^[a-zA-Z0-9_-]+$/.test(source)) {
    if(!plannedVolumes.has(source)) {
      const found=spawnSync('docker',['volume','inspect',source],{env,encoding:'utf8'});
      if(found.status===0) deny(`Preexisting named volume: ${source}`);
      plannedVolumes.add(source);events.push({kind:'volume-plan',name:source});flush();
    }
    return;
  }
  if(isAbsolute(source)) { const rel=relative(runtime,resolve(source)); if(rel && !rel.startsWith('..') && !isAbsolute(rel)) return; }
  deny(`Unapproved shared or host mount: ${source}`);
}
const server=createServer(async(req,res)=>{
 try {
  const parts=[]; for await(const p of req) parts.push(p); let body=Buffer.concat(parts);
  const pathname=new URL(req.url,'http://docker.local').pathname.replace(/^\/v[0-9.]+/,'');
  const method=req.method;
  const mutating=!['GET','HEAD'].includes(method);
  if(stopped && mutating) throw new Error('Provisioning stopped; further mutations denied');
  let createdName; let createdNetwork;
  if(method==='POST' && pathname==='/images/create') deny('Remote image pull prohibited');
  if(method==='POST' && pathname==='/containers/create') {
   const data=JSON.parse(body); createdName=new URL(req.url,'http://docker.local').searchParams.get('name');
   if (!createdName) {
    let kind; try { kind=identifyInitializationJob(data,project,ownedNetworks); } catch { deny('Initialization job ownership/target qualification failed'); }
    if(initializationJobs.has(kind)) deny('Duplicate initialization job');
    initializationJobs.add(kind);createdName=`supabase_init_${kind}_${project}`;
    const requestUrl=new URL(req.url,'http://docker.local');requestUrl.searchParams.set('name',createdName);req.url=requestUrl.pathname+requestUrl.search;
    events.push({kind:'initialization-job',job:kind,name:createdName,command_sha256:createHash('sha256').update(JSON.stringify(data.Cmd)).digest('hex'),database:`supabase_db_${project}`,network:data.HostConfig.NetworkMode});flush();
   }
   if(!createdName?.endsWith(`_${project}`)) deny(`Container name outside project: ${createdName}`);
   if(data.Labels?.['com.supabase.cli.project']!==project) deny(`Missing project ownership label: ${createdName}`);
   const mode=data.HostConfig?.NetworkMode;
   if(mode && !ownedNetworks.has(mode) && mode!=='none') deny(`Unapproved network: ${mode}`);
   const expected=manifest.cached_image_ids[data.Image];
   if(!expected || docker('image','inspect',data.Image,'--format','{{.Id}}')!==expected) deny(`Unapproved image identity: ${data.Image}`);
   for(const bind of data.HostConfig?.Binds??[]) checkMount(bind.replace(/:[^:]+(?::(?:ro|rw|z|Z))?$/,''));
   for(const mount of data.HostConfig?.Mounts??[]) checkMount(mount.Source??'');
   for(const mappings of Object.values(data.HostConfig?.PortBindings??{})) for(const map of mappings??[]) {
    if(!allowedPorts.has(String(map.HostPort))) deny(`Unapproved published port: ${map.HostPort}`);
    map.HostIp='127.0.0.1';
   }
   events.push({kind:'container-plan',name:createdName,image:data.Image,image_id:expected,binds:data.HostConfig?.Binds??[],ports:data.HostConfig?.PortBindings??{}});flush();
   body=Buffer.from(JSON.stringify(data));
   } else if(method==='POST' && pathname==='/networks/create') {
   const data=JSON.parse(body);
   if(data.Name===network && docker('network','inspect',network,'--format','{{.Id}}')===networkId) {
    events.push({kind:'owned-network-reuse',name:network,id:networkId});flush();
    res.writeHead(201,{'content-type':'application/json'});res.end(JSON.stringify({Id:networkId,Warning:''}));return;
   }
   if(data.Name!==manifest.cli_network_name || data.Labels?.['com.supabase.cli.project']!==project) deny(`Unapproved network name/label: ${data.Name}`);
   if(docker('network','ls','-q','--filter',`name=^${data.Name}$`)) deny('Preexisting CLI network');
   if(data.IPAM?.Config?.length) deny('Unexpected CLI-specified IPAM');
   data.IPAM={Driver:'default',Config:[{Subnet:manifest.cli_network_subnet}]};
   data.Options={...data.Options,'com.docker.network.bridge.host_binding_ipv4':'127.0.0.1'};
   createdNetwork=data.Name;events.push({kind:'network-plan',name:data.Name,subnet:manifest.cli_network_subnet});flush();body=Buffer.from(JSON.stringify(data));
  } else if(method==='POST' && pathname==='/volumes/create') {
   const data=JSON.parse(body);if(!data.Name?.endsWith(`_${project}`)) deny(`Volume outside project: ${data.Name}`);
   plannedVolumes.add(data.Name);events.push({kind:'volume-plan',name:data.Name});flush();
  } else if(mutating) {
   const c=pathname.match(/^\/containers\/([^/]+)/);
   const e=pathname.match(/^\/exec\/([^/]+)/);
   const v=pathname.match(/^\/volumes\/([^/]+)/);
   if(c) { const key=decodeURIComponent(c[1]);if(!owned.has(key) && ![...owned.values()].includes(key)) deny(`Mutation of unowned container: ${key}`); }
   else if(e) { if(!owned.has(`exec:${e[1]}`)) deny('Unowned exec'); }
   else if(v) { if(!decodeURIComponent(v[1]).endsWith(`_${project}`)) deny('Unowned volume'); }
   else if(pathname===`/networks/${networkId}/connect`||pathname===`/networks/${networkId}/disconnect`) {
    const data=JSON.parse(body);if(!owned.has(data.Container)) deny('Network attachment outside project');
   } else deny(`Unapproved Docker mutation: ${method} ${pathname}`);
  }
  const headers={...req.headers,host:'docker','content-length':String(body.length)};delete headers['transfer-encoding'];
  const upstream=httpRequest({socketPath:'//./pipe/docker_engine',path:req.url,method,headers},response=>{
   const track=createdNetwork || createdName || (method==='POST'&&/\/containers\/[^/]+\/exec$/.test(pathname));
   if(track) {
    const chunks=[];response.on('data',c=>chunks.push(c));response.on('end',()=>{
     const b=Buffer.concat(chunks);
     if(response.statusCode<300) {const value=JSON.parse(b);if(createdNetwork){ownedNetworks.add(value.Id);ownedNetworks.add(createdNetwork);events.push({kind:'network',id:value.Id,name:createdNetwork});}else if(createdName){owned.set(value.Id,createdName);events.push({kind:'container',id:value.Id,name:createdName});}else owned.set(`exec:${value.Id}`,'owned');flush();}
     res.writeHead(response.statusCode,response.headers);res.end(b);
    });
   }else {res.writeHead(response.statusCode,response.headers);response.pipe(res);}
  });
  upstream.on('error',error=>{res.writeHead(502);res.end(error.message);});upstream.end(body);
 }catch(error){if(!res.headersSent)res.writeHead(403,{'content-type':'application/json'});res.end(JSON.stringify({message:error.message}));}
});
server.listen(0,'127.0.0.1',()=>{
 const childEnv={...env,DOCKER_HOST:`tcp://127.0.0.1:${server.address().port}`};delete childEnv.DOCKER_CONTEXT;
 const cli=resolve(root,'.rybexos-local/m1-s1/toolchain/supabase.exe');
 const child=spawn(cli,['start','--workdir',runtime,'--network-id',network,'--yes'],{cwd:root,env:childEnv,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 child.on('exit',code=>{
  writeFileSync(resolve(root,'.rybexos-local/m1-s1/brc-start-private.json'),JSON.stringify({code,stdout,stderr}));
  const scrub=s=>s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]').replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[REDACTED KEY]').replace(/^.*(?:anon key|service_role key|secret key|publishable key|password).*$/gim,'[REDACTED CREDENTIAL LINE]');
  writeFileSync(resolve(evidence,'raw/provision-result.json'),JSON.stringify({exit:code,stopped,stdout:scrub(stdout),stderr:scrub(stderr)},null,2));
  manifest.phase=stopped?'STOPPED_PROVISIONING_BOUNDARY':code===0?'base-services-started':'STOPPED_PROVISIONING_FAILURE';manifest.resources_actual=events.filter(e=>['container','network','volume-plan'].includes(e.kind));manifest.baseline_checkpoint='NOT PASSED';
  const bytes=JSON.stringify(manifest,null,2);writeFileSync(resolve(evidence,'RUN-MANIFEST.json'),bytes);writeFileSync(resolve(evidence,'raw/run-manifest-03.json'),bytes);writeFileSync(resolve(evidence,'raw/run-manifest-03.sha256'),createHash('sha256').update(bytes).digest('hex'));
  console.log(JSON.stringify({exit:code,stopped,phase:manifest.phase,stop_events:events.filter(e=>e.kind==='STOP'),created_containers:events.filter(e=>e.kind==='container').length}));
  server.close(()=>process.exit(code??1));server.closeAllConnections?.();
 });
});
