"""Manifest-bound disposable database phases; no environment allocation or business SQL."""
from pathlib import Path
import sys, json, subprocess, hashlib, re, tarfile, io

manifest_path = Path(sys.argv[1]).resolve(strict=True)
mode = sys.argv[2]
m = json.loads(manifest_path.read_text())
r = Path.cwd().resolve()
assert m['version'] == 1 and Path(m['root']).resolve() == r
assert m['project'] == 'rybex-cfg03-q-m1-s1-recovery-20260928'
assert m['api'] == 'http://127.0.0.1:61421' and m['appPort'] == 61430 and m['scannerPort'] == 61428
p, out = Path(m['private']).resolve(), Path(m['evidence']).resolve()
assert p.is_relative_to(r / '.rybexos-local/m1-s1')
assert out.is_relative_to(r / 'artifacts/d5o-m1-s1-implementation-20260928T004316Z')
sha = lambda b: hashlib.sha256(b).hexdigest()
assert sha(Path(m['ownership']).read_bytes()) == m['ownershipSha256']
assert sha(Path(m['base']).read_bytes()) == m['baseSha256']
owned = json.loads(Path(m['ownership']).read_text())
db = owned['database_container']

def run(args, data=None):
    q = subprocess.run(args, input=data, capture_output=True)
    if q.returncode:
        (p / ('failure-' + mode + '.stderr-private')).write_bytes(q.stderr)
        raise RuntimeError('Owned phase command failed; private diagnostics retained')
    return q.stdout

def verify(stopped=False):
    rows = json.loads(run(['docker', 'inspect', *[x['id'] for x in owned['resources']]]))
    for x in rows:
        e = next(z for z in owned['resources'] if z['id'] == x['Id'])
        assert x['Name'] == e['name'] and x['Mounts'] == e['mounts']
        assert x['Config']['Labels']['com.supabase.cli.project'] == m['project']
        if stopped and x['Id'] != db: assert not x['State']['Running']
    return rows

def admin(cmd, data=None):
    return run(['docker', 'exec', '-i', db, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" exec ' + cmd], data)

def sql(text, database='postgres'):
    assert database in ('postgres', 'template1')
    return admin('psql -X -qAt -U supabase_admin -d ' + database + ' -v ON_ERROR_STOP=1', text.encode())

def fingerprints():
    return json.loads(sql("""do $$ declare t record; v text; begin create temporary table capture(k text,v jsonb); for t in select schemaname,tablename from pg_tables where schemaname in ('public','rybex_internal','auth','storage','supabase_migrations') order by 1,2 loop execute format('select jsonb_build_object(''count'',count(*),''md5'',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')))::text from %I.%I t',t.schemaname,t.tablename) into v; insert into capture values(t.schemaname||'.'||t.tablename,v::jsonb); end loop; end $$; select json_object_agg(k,v) from capture;"""))

def storage_snapshot():
    item = next(x for x in owned['resources'] if x['name'].startswith('/supabase_storage_'))
    data = run(['docker', 'cp', item['id'] + ':/mnt/.', '-'])
    with tarfile.open(fileobj=io.BytesIO(data)) as t:
        files = sorted([{'path':x.name,'bytes':x.size,'sha256':sha(t.extractfile(x).read())} for x in t.getmembers() if x.isfile()], key=lambda x:x['path'])
    return data, files

def schema_of(archive):
    return run(['docker','exec','-i',db,'pg_restore','--create','--schema-only','--file=-'],archive)

def restore(archive_path, label):
    verify(True)
    archive = archive_path.read_bytes()
    toc = run(['docker','exec','-i',db,'pg_restore','--list'],archive).decode()
    lines = [l for l in toc.splitlines() if l and not l.startswith(';')]
    markers = [' SCHEMA - extensions ', ' SCHEMA - graphql ', ' SCHEMA - graphql_public ', ' FUNCTION extensions grant_pg_graphql_access() ', ' EVENT TRIGGER - issue_pg_graphql_access ']
    phase_a = []
    for mark in markers:
        matches = [l for l in lines if mark in l]
        assert len(matches) == 1
        phase_a.extend(matches)
    phase_b = [l for l in lines if l not in phase_a]
    assert len(phase_a) + len(phase_b) == len(lines)
    schema = schema_of(archive).decode()
    creates = re.findall(r'^CREATE DATABASE postgres .*?;',schema,re.M|re.S)
    assert len(creates) == 1
    metadata = [l for l in schema.splitlines() if l.startswith(('ALTER DATABASE postgres ','COMMENT ON DATABASE postgres ','GRANT ')) and 'DATABASE postgres' in l]
    run(['docker','exec',db,'mkdir','-p','/tmp/m1-owned-phase'])
    run(['docker','cp',str(archive_path),db+':/tmp/m1-owned-phase/archive.dump'])
    for name, selection in [('A',phase_a),('B',phase_b)]:
        f=p/('restore-'+name+'.list');f.write_text('\n'.join(selection)+'\n')
        run(['docker','cp',str(f),db+':/tmp/m1-owned-phase/'+name+'.list'])
    sql('DROP DATABASE postgres WITH (FORCE);\n'+creates[0], 'template1')
    for name in ['A','B']:
        admin('pg_restore -U supabase_admin -d postgres --exit-on-error --use-list=/tmp/m1-owned-phase/'+name+'.list /tmp/m1-owned-phase/archive.dump')
    sql('BEGIN;\n'+'\n'.join(metadata)+'\nCOMMIT;')
    actual=admin('pg_dump -U supabase_admin -d postgres --create --schema-only')
    canonical=lambda b:re.sub(r'^\\(?:un)?restrict .*$', '',b.decode().replace('\r\n','\n'),flags=re.M)
    assert canonical(actual)==canonical(schema.encode()), 'Archive schema fidelity failed'
    (out/(label+'-restore.json')).write_text(json.dumps({'archive_sha256':sha(archive),'schema_matches':True,'entries':len(lines),'phase_a':len(phase_a),'phase_b':len(phase_b)},indent=2))

verify()
if mode == 'prepare':
    assert not (p/'candidate.dump').exists(), 'Do not overwrite recovery archive'
    run(['node',m['lifecycle'],'stop',m['preparationCycle']])
    verify(True)
    data=admin('pg_dump -U supabase_admin -d postgres -Fc');(p/'candidate.dump').write_bytes(data)
    (p/'candidate-schema-private.sql').write_bytes(schema_of(data))
    (p/'roles-private.sql').write_bytes(admin('pg_dumpall -U supabase_admin --roles-only'))
    (out/'DURABLE-BEFORE.json').write_text(json.dumps(fingerprints(),indent=2))
    storage, files=storage_snapshot();(p/'storage.tar').write_bytes(storage)
    (out/'STORAGE-BEFORE.json').write_text(json.dumps(files,indent=2))
    (out/'RECOVERY-SEAL.json').write_text(json.dumps({'candidate_sha256':sha(data),'storage_sha256':sha(storage),'base_sha256':m['baseSha256']},indent=2))
elif mode == 'base':
    label=sys.argv[3];assert label in m['allowedPhases']
    assert not (out/(label+'-restore.json')).exists(), 'Do not overwrite a phase'
    seal=json.loads((out/'RECOVERY-SEAL.json').read_text());assert sha((p/'candidate.dump').read_bytes())==seal['candidate_sha256']
    restore(Path(m['base']),label)
    assert json.loads(sql("select json_build_object('auth',to_regclass('auth.users') is not null,'storage',to_regclass('storage.objects') is not null,'empty',to_regclass('public.workspaces') is null);")) == {'auth':True,'storage':True,'empty':True}
elif mode == 'recover':
    seal=json.loads((out/'RECOVERY-SEAL.json').read_text());assert sha((p/'candidate.dump').read_bytes())==seal['candidate_sha256']
    restore(p/'candidate.dump','candidate')
    after=fingerprints();before=json.loads((out/'DURABLE-BEFORE.json').read_text());assert after==before
    storage,files=storage_snapshot();expected=json.loads((out/'STORAGE-BEFORE.json').read_text())
    if m.get('runtimePhase'):
        # Preserve every phase-created byte before removing only verified new files.
        (p/'phase-storage.tar').write_bytes(storage)
        baseline={x['path']:x for x in expected};current={x['path']:x for x in files}
        assert all(current.get(k)==v for k,v in baseline.items()), 'Existing Storage bytes changed'
        extras=[x for x in files if x['path'] not in baseline]
        item=next(x for x in owned['resources'] if x['name'].startswith('/supabase_storage_'))
        targets=[]
        for x in extras:
            name=x['path']
            assert not name.startswith('/') and '..' not in name.split('/') and '\\' not in name
            targets.append('/mnt/'+name)
        if targets:
            # Storage has to run for exec; gateway/Auth/PostgREST remain stopped.
            # Operate only on its verified owned container, then stop before fidelity checks.
            verify(True)
            run(['docker','start',item['id']])
            try:
                for target in targets: run(['docker','exec',item['id'],'rm','--',target])
            finally: run(['docker','stop',item['id']])
            verify(True)
            assert fingerprints()==before, 'Storage recovery changed database data'
        (out/'PHASE-STORAGE.json').write_text(json.dumps({'preserved_archive_sha256':sha(storage),'new_files':extras,'original_files_unchanged':True},indent=2))
        _,files=storage_snapshot()
    assert files==expected
    (out/'RECOVERY-RESULT.json').write_text(json.dumps({'status':'PASS','tables':len(after),'storage_files':len(files)},indent=2))
    run(['node',m['lifecycle'],'start',m['preparationCycle']])
else: raise RuntimeError('Unapproved phase')
print(json.dumps({'phase':mode,'status':'PASS'}))
