import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const digest = path => createHash("sha256").update(readFileSync(path)).digest("hex");
export function bindOwnedChildTarget(m, owner, env) {
  const resource = owner.resources.find(x => x.id === owner.database_container);
  const name = `supabase_db_${m.project}`;
  if (!resource || resource.name !== `/${name}` || m.project !== "rybex-cfg03-q-m1-s1-recovery-20260928" || m.api !== "http://127.0.0.1:61421" || m.appPort !== 61430 || m.scannerPort !== 61428) throw Error("Unapproved child target manifest");
  const bindings = {CFG_RUNTIME_01_DB_CONTAINER:name,CFG_RUNTIME_02_DB_CONTAINER:name,CFG_RUNTIME_03_DB_CONTAINER:name,RYBEX_QUALIFICATION_DB_CONTAINER:name,RYBEX_QUALIFICATION_PROJECT_ID:m.project};
  for (const [key,value] of Object.entries(bindings)) if (env[key] !== undefined && env[key] !== value) throw Error(`Conflicting child target: ${key}`);
  if (!env.RYBEX_QUALIFICATION_PROJECT_DIR || resolve(env.RYBEX_QUALIFICATION_PROJECT_DIR) !== resolve(m.runtimeDirectory)) throw Error("Unapproved child runtime directory");
  if (env.NEXT_PUBLIC_SUPABASE_URL !== m.api) throw Error("Owned API URL required");
  for (const [key,value] of Object.entries(env)) {
    if (/^(PGHOST|PGPORT|PGDATABASE|DOCKER_HOST|DATABASE_URL|DB_URL)$/i.test(key) && value) throw Error(`Unapproved alternate connection: ${key}`);
    if (/^(API_URL|SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL)$/i.test(key) && value !== m.api) throw Error(`Conflicting API: ${key}`);
    if (key === "PORT" && String(value) !== String(m.appPort)) throw Error("Conflicting app port");
    if (/^CFG_RUNTIME_0[123]_(WORKSPACE_ID|PACK_PATH|TENANT_KEY|CONFIG_KEY|ACTIVATION_SCOPE)$/.test(key) && value) throw Error(`Unapproved fixture override: ${key}`);
  }
  if (env.RYBEXOS_SCANNER_URL && env.RYBEXOS_SCANNER_URL !== `http://127.0.0.1:${m.scannerPort}`) throw Error("Conflicting scanner URL");
  if (env.RYBEXOS_SCANNER_MODE && env.RYBEXOS_SCANNER_MODE !== "local_service") throw Error("Conflicting scanner mode");
  return {...env,...bindings,M1_GATE_MODE:"owned",NEXT_PUBLIC_SUPABASE_URL:m.api,RYBEXOS_SCANNER_MODE:"local_service",RYBEXOS_SCANNER_URL:`http://127.0.0.1:${m.scannerPort}`};
}
export function dispatchOwnedLoader(m, owner, env, script, invoke) {
  const childEnv=bindOwnedChildTarget(m,owner,env);
  const entry=m.loaders?.find(x=>x.script===script);
  if (!entry || digest(resolve(m.root,script))!==entry.sha256 || digest(resolve(m.root,entry.pack))!==entry.packSha256) throw Error("Unsealed child loader or pack");
  return invoke(script,childEnv);
}
