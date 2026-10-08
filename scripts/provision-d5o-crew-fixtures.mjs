/** Synthetic crew accounts for the owned local D5O prototype only. */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { context, boundary } from "./m1/implementation-context.mjs";

boundary();
const c = await context();
if (c.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:61421") throw Error("wrong_local_auth_target");
const source = readFileSync(resolve("components/d5o/platform/schedule-model.ts"), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const compiledModule = { exports: {} };
new Function("module", "exports", output)(compiledModule, compiledModule.exports);
const roster = compiledModule.exports.peopleProfiles;
const workspaceIds = { rybex: "5488a1a7-d6eb-460c-88a4-4629d742d705", rotork: "fd59e25e-8fa3-496c-8e1f-58a3f0c0fdb6" };
const map = [];

function userId(workspace, person) {
  const hex = createHash("sha256").update(`d5o-synthetic-crew-v1:${workspace}:${person}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
for (const [workspace, profiles] of Object.entries(roster)) {
  const workspaceId = workspaceIds[workspace];
  const workspaceRow = await c.service.from("workspaces").select("id,organization_id,status").eq("id", workspaceId).single();
  if (workspaceRow.error || workspaceRow.data?.status !== "active" || !workspaceRow.data.organization_id) throw Error(`workspace_unavailable:${workspace}`);
  const orgId = workspaceRow.data.organization_id;
  for (const profile of profiles) {
    const id = userId(workspace, profile.name);
    const email = `crew-${workspace}-${profile.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")}@d5o-synthetic.local`;
    const existing = await c.service.auth.admin.getUserById(id);
    if (existing.data.user) {
      if (existing.data.user.email !== email) throw Error(`crew_identity_collision:${workspace}:${profile.name}`);
    } else {
      const made = await c.service.auth.admin.createUser({ id, email, password: c.env.FOUNDATION_0A_TEST_PASSWORD, email_confirm: true });
      if (made.error || made.data.user?.id !== id) throw Error(`crew_account_creation_failed:${workspace}:${profile.name}:${made.error?.message ?? "unknown"}`);
    }
    const currentProfile = await c.service.from("user_profiles").select("id,workspace_id,display_name").eq("user_id", id).maybeSingle();
    if (currentProfile.error || (currentProfile.data && (currentProfile.data.workspace_id !== workspaceId || currentProfile.data.display_name !== profile.name)))
      throw Error(`crew_profile_collision:${workspace}:${profile.name}`);
    if (!currentProfile.data) {
      const saved = await c.service.from("user_profiles").insert({ user_id:id, auth_user_id:id, email, display_name:profile.name,
        default_role:"read_only_auditor", active_workspace_id:workspaceId, workspace_id:workspaceId, organization_id:orgId, status:"active" }).select("id").single();
      if (saved.error || !saved.data) throw Error(`crew_profile_failed:${workspace}:${profile.name}:${saved.error?.message ?? "unknown"}`);
      currentProfile.data = saved.data;
    }
    const membership = await c.service.from("workspace_memberships").select("id,role,status").eq("workspace_id", workspaceId).eq("user_id", id).maybeSingle();
    if (membership.error || (membership.data && (membership.data.role !== "read_only_auditor" || membership.data.status !== "active")))
      throw Error(`crew_membership_collision:${workspace}:${profile.name}`);
    if (!membership.data) {
      const saved = await c.service.from("workspace_memberships").insert({ organization_id:orgId, workspace_id:workspaceId,
        user_profile_id:currentProfile.data.id, user_id:id, role:"read_only_auditor", status:"active" });
      if (saved.error) throw Error(`crew_membership_failed:${workspace}:${profile.name}:${saved.error.message}`);
    }
    map.push({ workspace, person: profile.name, userId: id });
  }
}
const directory = resolve(".rybexos-local/d5o-shared-schedule-v1");
mkdirSync(directory, { recursive:true });
const target = resolve(directory, "crew-identities.json");
const temporary = `${target}.tmp`;
writeFileSync(temporary, `${JSON.stringify(map,null,2)}\n`);
renameSync(temporary,target);
console.log(JSON.stringify({ status:"PASS", project:"rybex-cfg03-q-m1-s1-recovery-20260928", crewAccounts:map.length,
  identities:map.map(({workspace,person})=>({workspace,person})), registry:".rybexos-local/d5o-shared-schedule-v1/crew-identities.json" }));
