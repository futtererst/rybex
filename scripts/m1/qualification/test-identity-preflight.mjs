import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { ownedGateAdapter } from "./owned-gate-adapter.mjs";
const gate=ownedGateAdapter();assert(gate,"Explicit owned manifest required");
const m=gate.manifest;const owner=JSON.parse(readFileSync(m.ownership,"utf8"));
const entry=m.replay.find(x=>x.order===31);const source=readFileSync(entry.path,"utf8");
assert.equal(createHash("sha256").update(readFileSync(entry.path)).digest("hex"),entry.sha256);
const exact=source.match(/do \$preflight\$[\s\S]*?\$preflight\$;/i)?.[0];assert(exact);
const redirected=exact.replaceAll("public.","pg_temp.");
const id="00000000-0000-4000-8000-000000000001";
const sql=`BEGIN;
CREATE TEMP TABLE user_profiles AS SELECT id,user_id,auth_user_id FROM public.user_profiles WITH NO DATA;
CREATE TEMP TABLE opportunity_bid_evidence_satisfactions AS SELECT actor_profile_id,actor_auth_user_id,evidence_link_id,evidence_object_id,opportunity_id FROM public.opportunity_bid_evidence_satisfactions WITH NO DATA;
CREATE TEMP TABLE evidence_links AS SELECT id FROM public.evidence_links WITH NO DATA;
CREATE TEMP TABLE evidence_objects AS SELECT id FROM public.evidence_objects WITH NO DATA;
CREATE TEMP TABLE opportunities AS SELECT id FROM public.opportunities WITH NO DATA;
INSERT INTO pg_temp.user_profiles VALUES ('${id}','${id}','${id}');
INSERT INTO pg_temp.opportunity_bid_evidence_satisfactions VALUES ('${id}','${id}','${id}','${id}','${id}');
INSERT INTO pg_temp.evidence_links VALUES ('${id}');
INSERT INTO pg_temp.evidence_objects VALUES ('${id}');
INSERT INTO pg_temp.opportunities VALUES ('${id}');
${redirected}
DO $test$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
  DELETE FROM pg_temp.evidence_links;
  EXECUTE $exact$${redirected}$exact$;
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'cfg_runtime_03_authority_preflight_dangling_relationship' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'dangling negative did not reject'; END IF;
 IF (SELECT count(*) FROM pg_temp.evidence_links) <> 1 THEN RAISE EXCEPTION 'subtransaction did not restore negative fixture'; END IF;
END $test$;
SELECT json_build_object('coherent_positive',true,'dangling_negative',true,'negative_subtransaction_rolled_back',true,'replication_role_unchanged',current_setting('session_replication_role')='origin','live_foreign_keys_validated',(SELECT bool_and(convalidated) FROM pg_constraint WHERE conrelid='public.opportunity_bid_evidence_satisfactions'::regclass AND contype='f'),'live_identity_fk',(SELECT count(*)=1 FROM pg_constraint WHERE conrelid='public.opportunity_bid_evidence_satisfactions'::regclass AND conname='opportunity_bid_evidence_satisfactions_actor_identity_fkey'),'live_triggers_enabled',(SELECT bool_and(tgenabled<>'D') FROM pg_trigger WHERE tgrelid='public.opportunity_bid_evidence_satisfactions'::regclass));
ROLLBACK;
SELECT json_build_object('temporary_fixture_removed',to_regclass('pg_temp.evidence_links') is null);
`;
const p=spawnSync("docker",["exec","-i",owner.database_container,"psql","-X","-qAt","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"],{input:sql,encoding:"utf8",windowsHide:true});
assert.equal(p.status,0,"Identity predicate verification failed");const rows=p.stdout.trim().split(/\r?\n/).map(x=>JSON.parse(x));for(const row of rows)for(const value of Object.values(row))assert.equal(value,true);
writeFileSync(resolve(m.evidence,"IDENTITY-PREDICATE-RESULTS.json"),JSON.stringify({status:"PASS",scope:"Exact archived predicate with only public-to-pg_temp relation redirection; live constraint/trigger inspection; NOT original corrupted-database migration replay",migration_sha256:entry.sha256,checks:rows},null,2));
console.log(JSON.stringify({status:"PASS",checks:rows.reduce((n,r)=>n+Object.keys(r).length,0)}));
