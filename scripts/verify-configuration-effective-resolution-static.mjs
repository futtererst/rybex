import {
  check,
  finish,
  normalizeSql,
  readAllConfigurationSql,
} from "./configuration-foundation-static-utils.mjs";

const results = [];
const normalized = normalizeSql(readAllConfigurationSql());
const lifecycleFunctionMatch = /create or replace function public\.config_validate_configuration_version_lifecycle\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/i.exec(readAllConfigurationSql());
const lifecycleBody = normalizeSql(lifecycleFunctionMatch?.[1] || "");
const lifecycleLockIndex = lifecycleBody.indexOf("config_lock_tenant_configuration_lifecycle(new.tenant_configuration_id)");
const overlapIndex = lifecycleBody.indexOf("existing.tenant_configuration_id = new.tenant_configuration_id");

for (const token of [
  "config_tenant_template_activations",
  "config_tenant_configurations",
  "config_configuration_versions",
  "active_version_id",
  "active_configuration_version_id",
  "effective_from",
  "effective_to",
  "source_template_pack_version_id",
  "base_configuration_version_id",
  "rollback_of_configuration_version_id",
  "compatibility_json",
  "config_manifest_json",
  "diff_json",
  "published_at",
  "published_by",
  "activated_at",
  "rolled_back_at",
  "config_configuration_audit_events",
  "config_effective_configuration_version_id",
]) {
  check(results, `effective configuration support token exists: ${token}`, normalized.includes(token));
}

check(results, "draft/published lifecycle represented", normalized.includes("draft") && normalized.includes("published"));
check(results, "startup/no-history mode represented", normalized.includes("startup_no_history"));
check(results, "mature/historical-baseline mode represented", normalized.includes("mature_historical_baseline"));
check(results, "audit event compatibility tracking represented", normalized.includes("compatibility_checked"));
check(results, "no invalid activation_status reference remains", !normalized.includes("activation_status"));
check(results, "published effective interval overlap validator exists", normalized.includes("config_validate_configuration_version_lifecycle") && normalized.includes("must not overlap"));
check(results, "lifecycle validator uses transaction-scoped advisory lock", normalized.includes("pg_advisory_xact_lock") && normalized.includes("config_lock_tenant_configuration_lifecycle"));
check(results, "advisory lifecycle lock key is based on tenant_configuration_id", /pg_advisory_xact_lock\(\s*hashtext\('config_configuration_versions_lifecycle'\)\s*,\s*hashtext\(p_tenant_configuration_id::text\)\s*\)/.test(normalized));
check(results, "lifecycle lock occurs before overlap query", lifecycleLockIndex >= 0 && overlapIndex >= 0 && lifecycleLockIndex < overlapIndex, `lock=${lifecycleLockIndex}, overlap=${overlapIndex}`);
check(results, "previous unlocked-only lifecycle implementation is not sufficient", !(overlapIndex >= 0 && lifecycleLockIndex < 0));
check(results, "lifecycle trigger covers insert and lifecycle-relevant updates", /create trigger config_configuration_versions_validate_lifecycle before insert or update of status, effective_from, effective_to, tenant_configuration_id on config_configuration_versions/.test(normalized));
check(results, "configuration-version tenant configuration ownership is immutable", /create or replace function public\.config_prevent_configuration_version_reparenting\(\)/.test(normalized) && normalized.includes("configuration versions cannot change tenant_configuration_id after creation"));
check(results, "immutability trigger covers tenant_configuration_id updates", /create trigger config_configuration_versions_prevent_reparenting before update of tenant_configuration_id on config_configuration_versions[\s\S]*?execute function public\.config_prevent_configuration_version_reparenting\(\)/.test(normalized));
check(results, "overlap check uses half-open interval semantics", normalized.includes("coalesce(existing.effective_to, 'infinity'::timestamptz) > new.effective_from") && normalized.includes("coalesce(new.effective_to, 'infinity'::timestamptz) > existing.effective_from"));
check(results, "published effective start uniqueness exists", normalized.includes("config_configuration_versions_one_published_start_uniq"));
check(results, "tenant active configuration link validator exists", normalized.includes("config_validate_tenant_active_configuration_version") && normalized.includes("active configuration version must belong to the same tenant"));
check(results, "effective configuration resolves through tenant active version", normalized.includes("cv.id = ct.active_configuration_version_id"));
check(results, "effective configuration tie-breaker is deterministic", normalized.includes("order by cv.effective_from desc, cv.version desc, cv.id asc"));

finish(results, "Configuration Foundation effective-resolution static verification");
