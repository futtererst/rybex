import { bindOwnedChildTarget, dispatchOwnedLoader } from "./owned-child-target.mjs";
import { createServer } from "node:net";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, lstatSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { resolve, isAbsolute, relative } from "node:path";
import { spawnSync } from "node:child_process";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export function ownedGateAdapter() {
  if (process.env.M1_GATE_MODE !== "owned") return null;
  const path = process.env.M1_GATE_MANIFEST;
  if (!path || !isAbsolute(path)) throw new Error("Explicit absolute M1 gate manifest required");
  const m = JSON.parse(readFileSync(path, "utf8"));
  if (m.version !== 1 || resolve(m.root) !== process.cwd() || m.project !== "rybex-cfg03-q-m1-s1-recovery-20260928" || m.api !== "http://127.0.0.1:61421" || m.appPort !== 61430 || m.scannerPort !== 61428) throw new Error("Unapproved M1 gate target");
  if (sha(readFileSync(m.ownership)) !== m.ownershipSha256 || sha(readFileSync(m.base)) !== m.baseSha256) throw new Error("Owned baseline drift");
  const owner = JSON.parse(readFileSync(m.ownership, "utf8"));
  const db = owner.database_container;
  function verify() {
    const p = spawnSync("docker", ["inspect", ...owner.resources.map(x => x.id)], { encoding: "utf8", windowsHide: true });
    if (p.status !== 0) throw new Error("Owned resource inspection failed");
    for (const actual of JSON.parse(p.stdout)) {
      const e = owner.resources.find(x => x.id === actual.Id);
      if (!e || actual.Name !== e.name || JSON.stringify(actual.Mounts) !== JSON.stringify(e.mounts) || actual.Config.Labels?.["com.supabase.cli.project"] !== m.project) throw new Error("Owned resource drift");
    }
  }
  const driver = resolve("scripts/m1/qualification/owned-database-phase.py");
  if (sha(readFileSync(driver)) !== m.driverSha256) throw new Error("Unsealed phase driver");
  for (const entry of m.replay) if (sha(readFileSync(entry.path)) !== entry.sha256) throw new Error("Approved replay source drift");
  function phase(mode, label) {
    verify();
    const p = spawnSync("python", [driver, path, mode, ...(label ? [label] : [])], { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    if (p.status !== 0) throw new Error(`Owned ${mode} failed; private diagnostics retained`);
  }
  let active;
  let last = 0;
  return {
    manifest: m,
    childEnv(env) { const result=bindOwnedChildTarget(m,owner,env); verify(); return result; },
    borrowRuntime(env) {
      const result=bindOwnedChildTarget(m,owner,env); verify();
      return {borrowed:true,env:result,projectId:m.project,projectDir:m.runtimeDirectory,dbContainer:result.RYBEX_QUALIFICATION_DB_CONTAINER,ports:{api:61421,db:61422,app:m.appPort},bindings:owner.resources.map(x=>({id:x.id,name:x.name}))};
    },
    runLoader(script, env) {
      const tag=script.match(/load-cfg-runtime-(0[123])-pack-local\.mjs$/)?.[1];
      if(!tag) throw Error("Unapproved loader script");
      const target=resolve(m.evidence,`loader-${tag}-result.json`);
      if(existsSync(target)) throw Error("Loader evidence already exists");
      const result=dispatchOwnedLoader(m,owner,env,script,(path,childEnv)=>{
        verify();
        return spawnSync(process.execPath,[path],{cwd:m.root,env:childEnv,encoding:"utf8",windowsHide:true,maxBuffer:4*1024*1024});
      });
      let data;
      try { data=JSON.parse(result.stdout); } catch { data={}; }
      const safe=Object.fromEntries(Object.entries(data).filter(([key,value])=>["ok","workspaceId","templatePackKey","templatePackVersion","packHash","skippedActivation","activeConfigurationVersion","configurationVersionId","configurationVersion"].includes(key) && ["string","number","boolean"].includes(typeof value)));
      writeFileSync(target,JSON.stringify({exit:result.status,script,dbContainer:`supabase_db_${m.project}`,api:m.api,result:safe},null,2));
      if(result.status!==0 || data.ok!==true) throw Error(`Owned loader ${tag} failed; sanitized outcome retained`);
      verify();
      const query="BEGIN READ ONLY; select coalesce(json_agg(json_build_object('tenant_id',ct.id,'version_id',cv.id,'version',cv.version,'status',cv.status)),'[]') from public.config_tenants ct left join public.config_configuration_versions cv on cv.id=ct.active_configuration_version_id where ct.workspace_id='10000000-0000-4000-8000-000000000001'::uuid and ct.status<>'archived'; ROLLBACK;";
      const check=spawnSync("docker",["exec","-i",db,"psql","-X","-qAt","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",windowsHide:true});
      if(check.status!==0)throw Error("Owned mapping inspection failed");
      const mappings=JSON.parse(check.stdout.trim());
      writeFileSync(resolve(m.evidence,`loader-${tag}-owned-mapping.json`),JSON.stringify({mappings},null,2));
      if(mappings.length!==1 || !mappings[0].version_id || mappings[0].status!=="published")throw Error("Owned fixture mapping is not one valid published configuration");
    },
    async browserPort() {
      verify();
      await new Promise((yes, no) => { const server = createServer(); server.once("error", no); server.listen(m.appPort, "127.0.0.1", () => server.close(yes)); });
      return m.appPort;
    },
    browserOutput(suite) {
      verify();
      if (!m.allowedBrowsers?.includes(suite)) throw new Error("Browser suite not authorized by manifest");
      const evidence = resolve(m.evidence);
      const boundary = resolve(m.root, "artifacts/d5o-m1-s1-implementation-20260928T004316Z");
      const rel = relative(boundary, evidence);
      if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Unowned browser evidence root");
      for (let path = evidence; path !== resolve(m.root); path = resolve(path, "..")) if (lstatSync(path).isSymbolicLink()) throw new Error("Evidence reparse point");
      const finalRoot = resolve(evidence, suite);
      const temporaryRoot = resolve(evidence, `.tmp-${suite}-${randomUUID()}`);
      if (existsSync(finalRoot)) throw new Error("Browser evidence already exists");
      mkdirSync(temporaryRoot);
      let settled = false;
      return { root: m.root, activeRunRoot: evidence, temporaryRoot, finalRoot,
        finalize() { if (settled || existsSync(finalRoot)) throw new Error("Output already finalized"); renameSync(temporaryRoot, finalRoot); settled = true; return finalRoot; },
        abort() { if (settled) return; if (existsSync(temporaryRoot)) renameSync(temporaryRoot, resolve(evidence, `failed-${suite}-${randomUUID()}`)); settled = true; },
      };
    },
    prepare() { phase("prepare"); },
    recover() { phase("recover"); },
    async begin(label) {
      if (!m.allowedPhases.includes(label) || active) throw new Error("Unapproved or overlapping phase");
      phase("base", label); active = label; last = 0;
      return { projectId: m.project, projectDir: m.private, containerName: db, borrowed: true };
    },
    apply(container, first, end) {
      verify();
      if (!active || container !== db || first !== last + 1 || end < first) throw new Error("Replay phase/order mismatch");
      const entries = m.replay.filter(x => x.order >= first && x.order <= end);
      if (entries.length !== end - first + 1) throw new Error("Replay gap");
      for (const entry of entries) {
        const bytes = readFileSync(entry.path);
        if (sha(bytes) !== entry.sha256) throw new Error("Replay bytes changed");
        const p = spawnSync("docker", ["exec", "-i", db, "psql", "-X", "-q", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: bytes, encoding: "utf8", windowsHide: true });
        const output = resolve(m.evidence, `${active}-migration-${entry.order}.json`);
        if (existsSync(output)) throw new Error("Phase evidence already exists");
        writeFileSync(output, JSON.stringify({ source: entry.source, sha256: entry.sha256, exit: p.status, stdout: p.stdout, stderr: p.stderr }, null, 2));
        if (p.status !== 0) throw new Error(`Approved migration ${entry.order} failed; no repair permitted`);
        last = entry.order;
      }
    },
    end(disposable) {
      if (disposable && (!active || disposable.containerName !== db)) throw new Error("Phase ownership mismatch");
      active = undefined;
    },
  };
}
