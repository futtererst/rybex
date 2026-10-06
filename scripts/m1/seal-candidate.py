from pathlib import Path
import json,hashlib,zipfile,datetime,subprocess,os
root=Path.cwd(); evidence=root/'artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01'
run=json.loads((evidence/'RUN-MANIFEST.json').read_text()); admitted=json.loads(Path(run['source_manifest']).read_text())
tag=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'); out=evidence/('candidate-seal-'+tag); out.mkdir(); private=root/'.rybexos-local/m1-s1'/('candidate-seal-'+tag); private.mkdir()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
paths=set();differences=[]
protected=json.loads((evidence/'CANDIDATE-SOURCE-MANIFEST.json').read_text(encoding='utf-8'))
protected=[x for x in protected if x['path'].startswith(('app/','lib/','components/','supabase/','config/'))]
for x in protected:
 if digest(root/x['path'])!=x['sha256']:raise RuntimeError('Protected candidate source drift: '+x['path'])
for row in admitted:
 p=Path(row['path']);p=p if p.is_absolute() else root/p
 if digest(p)!=row['sha256']:differences.append(str(p.relative_to(root)))
 paths.add(p)
if differences:raise RuntimeError('Admitted source drift: '+str(differences))
for directory in ['scripts/m1','lib/d5o/work-record','app/m1-proof','components/d5o/work-record']:
 d=root/directory
 if d.exists():paths.update(p for p in d.rglob('*') if p.is_file() and '__pycache__' not in p.parts)
for rel in ['config/template-packs/d5o-m1-proof-rybex-v1.json','config/template-packs/d5o-m1-proof-rotork-v1.json','supabase/migrations/20260928214119_d5o_m1_work_record_gate.sql','supabase/migrations/20260929121652_d5o_m1_replay_configuration_guard.sql']:paths.add(root/rel)
rows=[{'path':p.relative_to(root).as_posix(),'sha256':digest(p),'bytes':p.stat().st_size} for p in sorted(paths)]
archive=private/'candidate-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for row in rows:z.write(root/row['path'],row['path'])
with zipfile.ZipFile(archive) as z:
 assert len(z.namelist())==len(rows)
 for row in rows:assert hashlib.sha256(z.read(row['path'])).hexdigest()==row['sha256']
(out/'SOURCE-MANIFEST.json').write_text(json.dumps(rows,indent=2))
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):
 p=subprocess.run(['git',*args],capture_output=True,text=True,env=env,check=True);return p.stdout.rstrip('\n')
gitstate={'branch':git('branch','--show-current'),'HEAD':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'staged':git('diff','--cached','--name-only').splitlines(),'modifiedTracked':git('diff','--name-only').splitlines(),'untracked':git('ls-files','--others','--exclude-standard').splitlines(),'conflicts':git('diff','--name-only','--diff-filter=U').splitlines(),'stash':git('stash','list','--format=%H %gd').splitlines()}
(out/'GIT-STATE.json').write_text(json.dumps(gitstate,indent=2))
result={'status':'PASS','admittedFilesVerified':len(admitted),'unexplainedAdmittedDrift':differences,'protectedCandidateFilesVerified':len(protected),'preservedFiles':len(rows),'archive':str(archive),'archiveSha256':digest(archive),'manifestSha256':digest(out/'SOURCE-MANIFEST.json'),'archiveReadback':'PASS','originalCheckout':'not modified by this task','git':{k:len(v) if isinstance(v,list) else v for k,v in gitstate.items()}}
(out/'RESULT.json').write_text(json.dumps(result,indent=2));print(json.dumps({'evidence':str(out),**result}))
