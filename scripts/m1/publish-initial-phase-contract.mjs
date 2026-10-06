import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { context, boundary } from "./implementation-context.mjs";

const target = process.argv[2];
const targets = {
  rybex: ".rybexos-local/m1-s1/d5o-config-admin-credentials.json",
  rotork: ".rybexos-local/m1-s1/d5o-rotork-config-admin-credentials.json",
};
if (!(target in targets)) throw new Error("workspace_key_required");
boundary();
const credential = JSON.parse(readFileSync(targets[target], "utf8"));
const source = readFileSync("components/d5o/platform/phase-configuration.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const phaseContract = { schemaVersion: 1, workTypes: structuredClone(exports.prototypePhaseConfigurationCatalog[target]) };
const labels = Object.fromEntries(phaseContract.workTypes[0].phases.map((phase) => [phase.key, phase.label]));
const ctx = await context();
const login = await ctx.anon.auth.signInWithPassword({ email: credential.email, password: credential.password });
if (login.error || login.data.user?.id !== credential.userId) throw new Error("synthetic_admin_login_failed");
const mappings = await ctx.anon.from("config_tenants").select("id,active_configuration_version_id")
  .eq("workspace_id", credential.workspace).neq("status", "archived");
if (mappings.error || mappings.data?.length !== 1) throw new Error("configuration_mapping_ambiguous");
const oldId = mappings.data[0].active_configuration_version_id;
if (!oldId) throw new Error("active_version_unavailable");
const sourceVersion = await ctx.anon.from("config_configuration_versions").select("id,status,config_manifest_json").eq("id", oldId).single();
if (sourceVersion.error || sourceVersion.data?.status !== "published") throw new Error("published_source_unavailable");
if (sourceVersion.data.config_manifest_json?.d5oPresentation?.phaseContract && process.argv[3] !== "--upgrade") {
  console.log(JSON.stringify({ status: "ALREADY_PUBLISHED", workspace: target, activeVersionId: oldId }));
  process.exit(0);
}
async function command(name, args) {
  const result = await ctx.anon.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}
const existingDrafts = await ctx.anon.from("config_configuration_versions").select("id,config_manifest_json")
  .eq("status", "draft");
if (existingDrafts.error) throw new Error(`draft_inventory_unavailable: ${existingDrafts.error.message}`);
const matching = (existingDrafts.data ?? []).filter((item) => item.config_manifest_json?.d5oSourceVersionId === oldId);
if (matching.length > 1) throw new Error("multiple_source_drafts_require_review");
const draftId = matching[0]?.id ?? (await command("d5o_configuration_create_draft_v1", { p_workspace: credential.workspace, p_expected_active: oldId })).draftVersionId;
const draftVersion = await ctx.anon.from("config_configuration_versions").select("config_manifest_json").eq("id", draftId).single();
if (draftVersion.error || !draftVersion.data) throw new Error("draft_manifest_unavailable");
const manifest = { ...draftVersion.data.config_manifest_json, d5oPresentation: { schemaVersion: 1, phaseLabels: labels, changeReason: process.argv[3] === "--upgrade" ? "Bind pinned phase decision checks to the Work Record prototype" : "Publish structured Discover and Define tenant phase forms", phaseContract } };
await command("d5o_configuration_save_draft_v1", { p_workspace: credential.workspace, p_draft: draftId, p_manifest: manifest });
const candidate = await command("d5o_configuration_publish_v1", { p_workspace: credential.workspace, p_draft: draftId, p_expected_active: oldId });
if (candidate.publishedVersionId !== draftId) throw new Error("candidate_identity_mismatch");
const activated = await command("d5o_configuration_activate_v1", { p_workspace: credential.workspace, p_candidate: candidate.publishedVersionId, p_expected_active: oldId });
if (activated.activeVersionId !== candidate.publishedVersionId) throw new Error("activation_identity_mismatch");
const verify = await ctx.anon.from("config_tenants").select("active_configuration_version_id").eq("workspace_id", credential.workspace).single();
if (verify.error || verify.data?.active_configuration_version_id !== candidate.publishedVersionId) throw new Error("activation_not_visible");
const sha256 = createHash("sha256").update(JSON.stringify(phaseContract)).digest("hex");
console.log(JSON.stringify({ status: "PASS", workspace: target, sourceVersionId: oldId, activeVersionId: candidate.publishedVersionId, contractSha256: sha256, workTypes: phaseContract.workTypes.map((item) => item.workTypeKey) }));
