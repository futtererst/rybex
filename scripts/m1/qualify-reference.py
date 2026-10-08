import pathlib,json,subprocess,os,secrets,hashlib,datetime
r=pathlib.Path.cwd();e=r/'artifacts/d5o-m1-s1-implementation-20260928T004316Z/retry-20260928';m=json.loads((e/'RUN-MANIFEST.json').read_text());assert m['phase']=='foundation-security-qualified-awaiting-reference'
env={k:v for k,v in os.environ.items() if k.upper() in ['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','PROGRAMFILES']};env.update(SUPABASE_HOME=str(r/'.rybexos-local/m1-s1/cli-home'),SUPABASE_TELEMETRY_DISABLED='1',DO_NOT_TRACK='1',CI='1')
db=m['database']['container_id'];inspect=json.loads(subprocess.check_output(['docker','inspect',db],text=True))[0];assert inspect['Config']['Labels']['com.supabase.cli.project']==m['project_id'];assert inspect['HostConfig']['PortBindings']['5432/tcp']==[{'HostIp':'127.0.0.1','HostPort':str(m['ports']['db'])}]
cli=str(r/'.rybexos-local/m1-s1/toolchain/supabase.exe');p=subprocess.run([cli,'status','--workdir',m['runtime_directory'],'-o','env'],env=env,text=True,capture_output=True);assert p.returncode==0
values={}
for line in p.stdout.splitlines():
 if '=' in line:
  k,v=line.split('=',1);values[k]=v.strip().strip('"')
assert values['API_URL']=='http://127.0.0.1:'+str(m['ports']['api'])
password=secrets.token_urlsafe(30)+'!';anon=values['ANON_KEY'];service=values['SERVICE_ROLE_KEY']
env.update(NEXT_PUBLIC_SUPABASE_URL=values['API_URL'],NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=anon,NEXT_PUBLIC_SUPABASE_ANON_KEY=anon,SUPABASE_SECRET_KEY=service,SUPABASE_SERVICE_ROLE_KEY=service,FOUNDATION_0A_TEST_PASSWORD=password,RYBEXOS_RUNTIME_MODE='test',RYBEXOS_AUTH_MODE='supabase',RYBEXOS_DATA_SOURCE='database',RYBEX_QUALIFICATION_PROJECT_ID=m['project_id'],RYBEX_QUALIFICATION_PROJECT_DIR=m['runtime_directory'],RYBEX_QUALIFICATION_DB_CONTAINER='supabase_db_'+m['project_id'],FOUNDATION_0A_RESULTS_PATH=str(e/'raw/foundation-0a-results.json'))
env.update(FOUNDATION_0B_RESULTS_PATH=str(e/'raw/foundation-0b-results.json'),P1_01A_RESULTS_PATH=str(e/'raw/p1-01a-results.json'),CFG_RUNTIME_02_DB_CONTAINER='supabase_db_'+m['project_id'])
# Record only secret-free invocation authority before fixture mutation.
m['phase']='before-reference-security-qualification';m['reference_scripts']={f:hashlib.sha256((r/f).read_bytes()).hexdigest() for f in ['scripts/bootstrap-foundation-0a-local.mjs','scripts/qa-foundation-0b-command-security.mjs','scripts/qa-foundation-0b-evidence-security.mjs','scripts/qa-p1-01a-opportunity.mjs','scripts/load-cfg-runtime-02-pack-local.mjs']};m['fixture_source']='unchanged foundation-0a synthetic fixtures';m['qualification_runner_sha256']=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
(e/'raw/before-reference-qualification.json').write_text(json.dumps(m,indent=2));(e/'RUN-MANIFEST.json').write_text(json.dumps(m,indent=2))
def scrub(s):
 for value in [password,anon,service]:s=s.replace(value,'[REDACTED]')
 return s
results=[]
for name in ['bootstrap-foundation-0a-local','qa-foundation-0b-command-security','qa-foundation-0b-evidence-security','qa-p1-01a-opportunity']:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['node','scripts/'+name+'.mjs'],env=env,text=True,capture_output=True);result={'command':['node','scripts/'+name+'.mjs'],'started_utc':start,'exit':p.returncode,'stdout':scrub(p.stdout),'stderr':scrub(p.stderr)};(e/('raw/reference-'+name+'-execution.json')).write_text(json.dumps(result,indent=2));results.append({'name':name,'exit':p.returncode});print(json.dumps({'name':name,'exit':p.returncode,'tail':scrub(p.stderr or p.stdout)[-2500:]}),flush=True)
 if p.returncode!=0:break
m['phase']='STOPPED_BASELINE_QUALIFICATION_FAILURE' if any(x['exit'] for x in results) else 'foundation-reference-qualified-awaiting-configured-reference';m['baseline_checkpoint']='NOT PASSED';m['qualification_results']=results
actors=subprocess.check_output(['docker','exec',db,'psql','-U','postgres','-d','postgres','-X','-At','-c',"select coalesce(json_agg(json_build_object('id',id,'email',email)),'[]'::json) from auth.users;"],text=True);m['actors_actual']=json.loads(actors);(e/'RUN-MANIFEST.json').write_text(json.dumps(m,indent=2))
