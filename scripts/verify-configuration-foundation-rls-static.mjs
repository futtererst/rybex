import {
  check,
  finish,
  normalizeSql,
  readAllConfigurationSql,
} from "./configuration-foundation-static-utils.mjs";

const results = [];
const normalized = normalizeSql(readAllConfigurationSql());

function policySql(policyName) {
  const match = new RegExp(`create policy ${policyName}\\b[\\s\\S]*?;`).exec(normalized);
  return match?.[0] || "";
}

const rlsTables = [
  "config_tenants",
  "config_organizations",
  "config_operating_entities",
  "config_template_packs",
  "config_template_pack_versions",
  "config_tenant_template_activations",
  "config_tenant_configurations",
  "config_configuration_versions",
  "config_phase_definitions",
  "config_gate_definitions",
  "config_gate_questions",
  "config_gate_evidence_requirements",
  "config_gate_decision_outcomes",
  "config_work_item_type_definitions",
  "config_work_class_definitions",
  "config_workstreams",
  "config_service_lanes",
  "config_role_definitions",
  "config_permission_definitions",
  "config_decision_right_definitions",
  "config_artifact_type_definitions",
  "config_evidence_type_definitions",
  "config_kpi_definitions",
  "config_financial_model_definitions",
  "config_workforce_qualification_rules",
  "config_handoff_definitions",
  "config_governance_forum_definitions",
  "config_exception_rules",
  "config_workforce_gate_dependency_links",
  "config_handoff_required_evidence_links",
  "config_governance_forum_participant_role_links",
  "config_governance_forum_kpi_links",
  "config_exception_approval_role_links",
  "config_configuration_audit_events",
];

for (const table of rlsTables) {
  check(results, `${table} enables RLS`, normalized.includes(`alter table ${table} enable row level security`));
}

for (const table of rlsTables) {
  check(
    results,
    `${table} grants authenticated table privileges for RLS mediation`,
    new RegExp(`grant select, insert, update, delete on[\\s\\S]*?\\b${table}\\b[\\s\\S]*?to authenticated`).test(normalized),
  );
}

for (const helper of [
  "config_is_service_role",
  "config_current_tenant_id",
  "config_can_read_tenant_configuration",
  "config_can_admin_tenant_configuration",
  "config_can_audit_tenant_configuration",
  "config_can_read_configuration_version",
  "config_can_admin_configuration_version",
  "config_version_is_draft",
  "config_effective_configuration_version_id",
]) {
  check(results, `helper predicate/function present: ${helper}`, normalized.includes(`function public.${helper}`));
}

check(results, "no false platform-admin helper is defined", !normalized.includes("function public.config_is_platform_admin"));
check(results, "tenant read helper does not grant cross-tenant platform-admin access", !/config_can_read_tenant_configuration[\s\S]*?config_is_platform_admin/.test(normalized));
check(results, "global template-pack insert is service-role-only", policySql("config_template_packs_insert").includes("with check (public.config_is_service_role())"));
check(results, "global template-pack update is service-role-only", policySql("config_template_packs_update").includes("using (public.config_is_service_role() and status <> 'released')") && policySql("config_template_packs_update").includes("with check (public.config_is_service_role())"));
check(results, "global template-pack-version insert is service-role-only", policySql("config_template_pack_versions_insert").includes("with check (public.config_is_service_role())"));
check(results, "global template-pack-version update is service-role-only", policySql("config_template_pack_versions_update").includes("using (public.config_is_service_role() and status <> 'released')") && policySql("config_template_pack_versions_update").includes("with check (public.config_is_service_role())"));
check(results, "workspace admin predicate remains tenant-scoped", /config_can_admin_tenant_configuration[\s\S]*?ct\.id = p_tenant_id[\s\S]*?wm\.role = 'admin'/.test(normalized));
check(results, "configuration-version update WITH CHECK validates proposed tenant configuration", policySql("config_configuration_versions_update").includes("with check ( public.config_can_admin_tenant_configuration(public.config_tenant_configuration_tenant_id(tenant_configuration_id)) )"));
check(results, "configuration-version update does not validate proposed row through stale version id", !policySql("config_configuration_versions_update").includes("with check (public.config_can_admin_configuration_version(id))"));

check(results, "direct delete restrictions are present", normalized.includes("_no_delete"));
check(results, "audit update is denied", normalized.includes("config_configuration_audit_events_no_update"));
check(results, "audit insert is service-role-only", normalized.includes("config_configuration_audit_events_insert") && normalized.includes("with check (public.config_is_service_role())"));
check(results, "configuration definitions require draft for mutation", normalized.includes("public.config_version_is_draft(configuration_version_id)"));
check(results, "no broad select using true policies", !/for select[^;]+using\s*\(\s*true\s*\)/i.test(normalized));

finish(results, "Configuration Foundation RLS static verification");
