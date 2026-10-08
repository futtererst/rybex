import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { context, sql } from "./m1/implementation-context.mjs";

const credential = JSON.parse(readFileSync(resolve(".rybexos-local/m1-s1/d5o-config-admin-credentials.json"), "utf8"));
const ctx = await context();
const login = await ctx.anon.auth.signInWithPassword({ email: credential.email, password: credential.password });
if (login.error || login.data.user?.id !== credential.userId) throw new Error("synthetic_admin_login_failed");
const mapping = await ctx.anon.from("config_tenants").select("id,active_configuration_version_id")
  .eq("workspace_id", credential.workspace).neq("status", "archived");
if (mapping.error || mapping.data?.length !== 1 || !mapping.data[0].active_configuration_version_id) {
  throw new Error("admin_mapping_unavailable");
}
const stale = await ctx.anon.rpc("d5o_configuration_create_draft_v1", {
  p_workspace: credential.workspace,
  p_expected_active: "00000000-0000-4000-8000-000000000000",
});
if (!stale.error?.message.includes("stale_configuration_default")) {
  throw new Error(`admin_rpc_not_reached: ${stale.error?.message ?? JSON.stringify(stale.data)}`);
}
const unchanged = sql(`select count(*) from config_configuration_versions where config_manifest_json->>'d5oSourceVersionId'=
  '${mapping.data[0].active_configuration_version_id}' and status='draft'`);
if (unchanged !== "0") throw new Error("unexpected_draft_created");
console.log(JSON.stringify({ status: "PASS", actor: credential.email, workspace: credential.workspace,
  activeVersionId: mapping.data[0].active_configuration_version_id, staleCommandRejected: true }));
