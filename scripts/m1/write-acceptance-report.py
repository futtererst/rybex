from pathlib import Path
import json,datetime,hashlib
root=Path.cwd();d=root/'artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def latest(pattern):
 files=sorted(d.glob(pattern));assert files,pattern
 p=files[-1];x=load(p);assert x.get('status')=='PASS',(str(p),x.get('status'));return p,x
def link(p):return '['+p.name+'](<'+p.resolve().as_posix()+'>)'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
groups={}
for key,pattern in [('replay-guard','REPLAY-CONFIGURATION-GUARD-20*.json'),('scenarios','SCENARIOS-20*.json'),('core','CONTRACT-*.json'),('configuration','CONFIGURATION-SECURITY-*.json'),('security','EXTENDED-SECURITY-*.json'),('atomicity','ATOMICITY-*.json'),('concurrency','CONCURRENT-INVALIDATION-*.json'),('invariance','INVARIANCE-*.json'),('edges','ACCEPTANCE-EDGES-*.json'),('adversarial','ADVERSARIAL-INVARIANCE-*.json'),('storage','STORAGE-SCOPE-*.json'),('history','HISTORY-IDENTITY-*.json'),('mapping','MAPPING-GATE-*.json'),('prerequisites','SCENARIO-PREREQUISITES-*.json'),('expiry','EXCEPTION-EXPIRY-*.json'),('browser','BROWSER-20*.json'),('schema','FINAL-SCHEMA-*.json'),('schema-contract','SCHEMA-CONTRACT-TESTS-*.json'),('regression','REGRESSION-*.json')]:groups[key]=latest(pattern)
correction=d/'replay-guard-correction-20260929-01'
for key,rel in [('correction-replay','SCHEMA-COMPARISON-RECONCILED.json'),('correction-application','candidate-application-verified/RESULT.json'),('correction-recovery','corrected-candidate-recovery/RESULT.json'),('correction-source','SOURCE-ARCHITECTURE-CHECK.json')]:
 p=correction/rel; x=load(p); assert x['status']=='PASS'; groups[key]=(p,x)
p=sorted(d.glob('replay-guard-tests-*/RESULT.json'))[-1];assert load(p)['status']=='PASS';groups['correction-regressions']=(p,load(p))
assert len(groups['replay-guard'][1]['results'])==31
assert groups['schema'][1]['ledgerCount']==35
p1=d/'references-2026-09-28T23-33-34-294Z/p1-results.json';p1data=load(p1);assert p1data['passedTests']==21 and p1data['failedTests']==0;groups['p1']=(p1,p1data)
seal=sorted(d.glob('candidate-seal-*/RESULT.json'))[-1];assert load(seal)['status']=='PASS'
for name in ['cfg01','cfg02','cfg03','p1b1','p1b2','p1a']:
 p=sorted(d.glob('isolated-browser-'+name+'-*/RESULT.json'))[-1];assert load(p)['status']=='PASS';groups['browser-'+name]=(p,load(p))
for name in ['cfg01','cfg02','cfg03']:
 p=sorted(d.glob('isolated-'+name+'-*/RESULT.json'))[-1];assert load(p)['status']=='PASS';groups[name]=(p,load(p))
for prefix in ['typecheck','lint']:
 p=sorted(d.glob(prefix+'-20*.json'))[-1];assert load(p)['exit']==0;groups[prefix]=(p,load(p))
# Do not turn process completion into acceptance: every mandatory assertion must be successful.
for key,(p,x) in groups.items():
 for row in x.get('results',[]):
  if 'status' in row:assert row['status']=='PASS',(key,row)
criteria={
'C01':('core history mapping','Stable identity, reopening, source uniqueness and explicit synthetic multi-source mapping; no bulk conversion.'),
'C02':('configuration mapping replay-guard','Zero/multiple/invalid/version/lineage/type cases fail closed; swapped unique mappings resolve configured work.'),
'C03':('core security storage','Scoped authenticated/anonymous RPC, table, evidence, history, Storage and signed-download denial; baseline project access retained.'),
'C04':('invariance adversarial configuration replay-guard','Exact pinned version/digest survives new defaults; tampering/withdrawal deny; historical configuration stays referenced.'),
'C05':('core security storage','Missing, unfinalized, failed, revoked, wrong-scope and wrong-revision evidence rejected.'),
'C06':('core security adversarial','Separate responsibilities, assignment/eligibility and separation of duty; no unassigned authority shortcut.'),
'C07':('core adversarial edges expiry','Failure blocks; retest or independently authorized permitted exception; wrong scope/expiry/nonwaivable denial; no automatic owner acceptance.'),
'C08':('core','Committed hold without advancement; subsequent immutable proof revision.'),
'C09':('core configuration edges replay-guard','Actor/payload/target-bound idempotency; revoked membership denied.'),
'C10':('core','Two same-version commands: one success and one conflict.'),
'C11':('concurrency','Both real invalidation/acceptance orderings tested.'),
'C12':('atomicity core replay-guard','Nine injected write/commit faults and guard denials leave no partial authoritative effects; valid hold commits.'),
'C13':('history cfg01 cfg02 cfg03','Authenticated historical reconstruction after exact database/Storage recovery.'),
'C14':('invariance adversarial mapping','Both gates execute in both workspaces; pack/evidence/authority/outcome/label swaps and neutral organization label; unchanged engine.'),
'C15':('core configuration security edges','Progression/reopen and typed child/derived/repeat/follow-on, eight-dimension rationale, independent obligation, cycle and cross-scope checks.'),
'C16':('browser','Actual local authenticated proof surface, action, stale, held, unavailable and read-only states.'),
'C17':('regression p1 cfg01 cfg02 cfg03 browser-cfg01 browser-cfg02 browser-cfg03 browser-p1b1 browser-p1b2 browser-p1a','Current baseline/security/configuration and browser references; unchanged B2/B3 remain separately red.'),
'C18':('schema schema-contract correction-replay correction-application correction-recovery','CLI fresh/upgrade replay equivalence, 35-entry ledger, multiple exact candidate/Storage recoveries; prior runner proof preserved.'),
'C19':('core history adversarial','Historical actor/assignment/role/right/configuration/proof/state/outcome remains reconstructable after current assignment/role/default changes.'),
'C20':('core security browser','Concrete blockers and actions; server rejects missing prerequisites and client readiness assertions.'),
'C21':('core prerequisites scenarios','Rybex test/remediation/exception/quality/owner acceptance with explicitly fixture-backed upstream operations.'),
'C22':('core prerequisites scenarios','Rotork assessment/pilot/review/commercial/rollout guards and separate authority.'),
'C23':('core','Separate aggregate concurrency and immutable proof revision semantics.'),
'C24':('schema','Previously approved H1-H5, corrections, sealed pre-domain entry and exact owned environment retained.'),
'C25':('edges','Typed financial/value commitments preserve owner/source/metric/currency/baseline/target; outcomes never fabricate realized value.'),
'C26':('history mapping','One Work Record root reuses existing Work Item type/configuration definitions; legacy IDs preserved.')}
tag=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');out=d/('acceptance-'+tag);out.mkdir()
rows=[]
for key,(names,why) in criteria.items():rows.append('| '+key+' | PASS | '+why+' | '+'; '.join(link(groups[n][0]) for n in names.split())+' |')
(out/'ACCEPTANCE-CRITERIA.md').write_text('# M1-S1 technical acceptance\n\n26/26 PASS for the bounded synthetic local proof. Human acceptance and production authorization are not implied.\n\n| Criterion | Result | Meaning and limits | Direct evidence |\n|---|---|---|---|\n'+'\n'.join(rows)+'\n',encoding='utf-8')
(out/'EVIDENCE-INDEX.json').write_text(json.dumps({k:{'path':str(p),'sha256':digest(p)} for k,(p,x) in groups.items()},indent=2),encoding='utf-8')
sections={
'SECURITY-RESULTS.md':('Security', ['configuration','security','storage','regression','replay-guard']),
'AUTHORITY-RESULTS.md':('Authority',['core','adversarial','history','expiry']),
'CONCURRENCY-RESULTS.md':('Concurrency and rollback',['core','concurrency','atomicity']),
'PROOF-REVISION-RESULTS.md':('Proof revision',['core','security','history']),
'RYBEX-SCENARIO-RESULTS.md':('Rybex synthetic gate',['core','prerequisites','mapping','expiry']),
'ROTORK-SCENARIO-RESULTS.md':('Rotork synthetic gate',['core','prerequisites','mapping']),
'CONFIGURATION-INVARIANCE.md':('Configuration invariance',['invariance','adversarial','mapping']),
'REGRESSION-RESULTS.md':('Regression',['regression','p1','cfg01','cfg02','cfg03','browser-cfg01','browser-cfg02','browser-cfg03','browser-p1b1','browser-p1b2','browser-p1a']),
'SCHEMA-FINGERPRINT.md':('Schema fingerprint',['schema']),
'RECOVERY-RESULTS.md':('Recovery',['correction-recovery','history'])}
for filename,(title,keys) in sections.items():
 text='# '+title+'\n\nPASS within the owned synthetic local environment.\n\n'+'\n'.join('- '+link(groups[k][0]) for k in keys)+'\n'
 if filename=='REGRESSION-RESULTS.md':text+='\nPreserved debt: Billing domain expects `Pay App 003` but receives `PA-001`; the layout verifier retains the same 13 failures. These suites are not PASS. The historical four-digit migration checker passed but cannot alone validate the timestamped M1 migration; the exact CLI ledger/schema checks supply that proof.\n'
 if 'SCENARIO' in filename:text+='\nUpstream operational facts and authority actors are synthetic persisted fixtures. No Field/NCR/service product, real delegated authority, or realized financial value is claimed.\n'
 (out/filename).write_text(text,encoding='utf-8')
source=load(seal)
(out/'SOURCE-BASELINE.md').write_text('# Source baseline\n\nHEAD `ef5cfe85fd7dc516db1bf0510b42147d47b0b1c6` plus the approved source overlay (`d5414344c6bc14d25b1a897ea3870df4685ab4430ee35d51fad001377d53793a`), explicitly authorized baseline corrections, and bounded M1 implementation. All 1,473 admitted source hashes remain intact. The candidate seal also verifies the previously sealed runtime/migration/configuration files.\n\n'+link(seal)+'\n\nRecovery: extract the sealed source archive only into a new disposable directory, verify every SOURCE-MANIFEST entry, reproduce pinned dependencies, then use the sealed CLI migration/configuration fixtures in the exclusively owned disposable environment. Do not extract over the original dirty checkout. Secrets/runtime credentials are excluded; they are not part of the source archive.\n',encoding='utf-8')
(out/'DATABASE-REPLAY.md').write_text('# Database replay\n\nApproved forward correction: 35-source fresh replay and 34-to-35 upgrade. The two authorized function bodies are the only changed baseline definitions; grants/ownership/security and other schema blocks remain intact. The separate expected Realtime date partition is checked strictly. Corrected candidate data, ledger and Storage are archived and restored exactly. Historical wrapper failures are preserved with evidence identifying and correcting multiline parsing and asymmetric transport normalization.\n\n'+link(groups['correction-replay'][0])+'\n\n'+link(groups['correction-application'][0])+'\n\n'+link(groups['correction-recovery'][0])+'\n\n'+link(groups['schema'][0])+'\n',encoding='utf-8')
(out/'CHANGE-MANIFEST.md').write_text('# Change manifest\n\nThe approved amendment adds migration 20260929121652_d5o_m1_replay_configuration_guard.sql replacing only the two public create/execute functions. Only narrowly related scripts/m1 qualification/report wrappers and appended evidence changed alongside it. All prior migrations, 1,473 admitted source files and 506 protected candidate files remain unchanged.\n\n'+link(correction/'TWO-FUNCTION-SOURCE.diff')+'\n\n'+link(seal.parent/'SOURCE-MANIFEST.json')+'\n\n'+link(seal.parent/'GIT-STATE.json')+'\n',encoding='utf-8')
(out/'REPORT.md').write_text('''# M1-S1 candidate qualification

Solving for one reproducible, scoped, configurable Work Record gate engine. Criticality: high; incorrect qualification could conceal authority, evidence or recovery failures.

M1-S1 technical acceptance: **PASS — 26/26 criteria**, bounded to the approved synthetic local slice. Ready for human implementation review. This is not human acceptance, production readiness or deployment authorization.

The cached-command configuration bypass is closed by the separately approved forward correction. Both create and execute retries revalidate the original scoped configuration pin before returning cached success. The 31-case matrix proves invalid mapping/version/lineage/content/membership denial, request identity checks, valid superseded-pin replay and no new authoritative effects. Fresh35, incremental34-to35, no-op replay, exact two-function schema comparison and corrected-candidate recovery pass. The prior 26/26 draft at acceptance-20260929T001818Z remains withdrawn; this new report does not rewrite it. Earlier schema-wrapper failures remain visible and were resolved as parser/transport comparison defects, not runtime changes. The allowed Realtime date partition remains separately qualified.

Current baseline suites: Evidence 23/23, Foundation 39/39, Command 18/18, Billing 14/14, Field 24/24, Closeout 20/20. Reference database gates: P1 21/21; CFG01 14/14, CFG02 23/23, CFG03 59/59. Previously sealed baseline reference/browser evidence is retained because its protected implementation and fixtures are unchanged; it is not claimed to have been rerun for this amendment. Affected M1 and baseline security/regression suites and the M1 proof surface were rerun against the corrected candidate. Typecheck/lint pass. The two accepted baseline debts remain red and unchanged.

Both work configurations execute through identical engine definitions, including full swapped-workspace gates with neutral organization labels. Configured evidence, authority and lifecycle/outcome variations change behavior; nonwaivable failures remain blocked. Historical authority, proof revisions and financial/value relationships remain reconstructable without claiming value realization.

Only the owned `rybex-cfg03-q-m1-s1-recovery-20260928` environment was used. The original dirty checkout and excluded stacks were not modified. The previously human-accepted residual uncertainty about historical discarded loader output remains historical; this report does not erase it.

Best next step: review the bounded implementation and acceptance evidence. No broader product, remote/shared system or production work is authorized by this result.

'''+link(out/'ACCEPTANCE-CRITERIA.md')+'\n\n'+link(seal)+'\n',encoding='utf-8')
(out/'PACKAGE-SEAL.json').write_text(json.dumps([{'path':p.name,'sha256':digest(p)} for p in sorted(out.iterdir()) if p.is_file()],indent=2),encoding='utf-8');print(str(out/'REPORT.md'))
