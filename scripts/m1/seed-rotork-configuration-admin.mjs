import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { context, sql, q, boundary } from "./implementation-context.mjs";

const workspace = "fd59e25e-8fa3-496c-8e1f-58a3f0c0fdb6";
const email = "d5o-rotork-config-admin@synthetic.local";
const credentialPath = resolve(".rybexos-local/m1-s1/d5o-rotork-config-admin-credentials.json");
boundary();
if (existsSync(credentialPath)) throw new Error("synthetic_admin_already_provisioned");
if (sql(`select count(*) from auth.users where email=${q(email)}`) !== "0") throw new Error("synthetic_admin_identity_exists");
const organization = sql(`select organization_id from workspaces where id=${q(workspace)} and status='active'`);
if (!/^[0-9a-f-]{36}$/i.test(organization)) throw new Error("workspace_organization_unavailable");
const ctx = await context();
const password = randomBytes(24).toString("base64url");
const created = await ctx.service.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error || !created.data.user) throw new Error(created.error?.message ?? "synthetic_admin_creation_failed");
const userId = created.data.user.id;
const profileId = randomUUID();
try {
  sql(`begin;
    insert into user_profiles(id,organization_id,workspace_id,active_workspace_id,user_id,auth_user_id,
      display_name,email,status)
    values(${q(profileId)},${q(organization)},${q(workspace)},${q(workspace)},${q(userId)},${q(userId)},
      'D5O Rotork System Administrator',${q(email)},'active');
    insert into workspace_memberships(id,organization_id,workspace_id,user_profile_id,user_id,role,status)
    values(${q(randomUUID())},${q(organization)},${q(workspace)},${q(profileId)},${q(userId)},'admin','active');
    commit;`);
  const login = await ctx.anon.auth.signInWithPassword({ email, password });
  if (login.error || login.data.user?.id !== userId) throw new Error("synthetic_admin_login_failed");
  mkdirSync(resolve(".rybexos-local/m1-s1"), { recursive: true });
  writeFileSync(credentialPath, JSON.stringify({ email, password, workspace, userId }, null, 2), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: "PASS", email, userId, workspace, credentialPath }));
} catch (error) {
  await ctx.service.auth.admin.deleteUser(userId);
  throw error;
}
