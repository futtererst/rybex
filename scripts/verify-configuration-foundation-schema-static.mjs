import {
  check,
  createdTableNames,
  expectedConfigurationMigrations,
  extractCreateTablesByFile,
  extractForeignKeysByFile,
  extractIndexesByFile,
  extractFunctionsByFile,
  extractTriggersByFile,
  finish,
  normalizeSql,
  readAllConfigurationSql,
  readMigration,
} from "./configuration-foundation-static-utils.mjs";

const results = [];
const sql = readAllConfigurationSql();
const normalized = normalizeSql(sql);
const tables = extractCreateTablesByFile();
const indexes = extractIndexesByFile();
const foreignKeys = extractForeignKeysByFile();
const functions = extractFunctionsByFile();
const triggers = extractTriggersByFile();
const allowedExternalTables = new Set(["users", "organizations", "workspaces"]);

const requiredTables = [
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

for (const table of requiredTables) {
  check(results, `${table} table definition exists`, normalized.includes(`create table if not exists ${table}`));
}

for (const index of indexes) {
  const table = tables.get(index.tableName);
  check(results, `${index.fileName}:${index.indexName} references existing table ${index.tableName}`, Boolean(table));

  if (table) {
    for (const column of index.columns) {
      check(results, `${index.fileName}:${index.indexName} references existing column ${index.tableName}.${column}`, table.columns.has(column));
    }
    for (const column of index.predicateColumns) {
      check(results, `${index.fileName}:${index.indexName} predicate references existing column ${index.tableName}.${column}`, table.columns.has(column));
    }
  }
}

for (const foreignKey of foreignKeys) {
  const table = tables.get(foreignKey.tableName);
  const referencedTable = tables.get(foreignKey.referencedTableName);
  const referencedTableAllowed = Boolean(referencedTable) || allowedExternalTables.has(foreignKey.referencedTableName);

  check(results, `${foreignKey.fileName}:${foreignKey.constraintName} references existing table ${foreignKey.tableName}`, Boolean(table));
  check(results, `${foreignKey.fileName}:${foreignKey.constraintName} references known table ${foreignKey.referencedTableName}`, referencedTableAllowed);

  if (table) {
    for (const column of foreignKey.columns) {
      check(results, `${foreignKey.fileName}:${foreignKey.constraintName} references existing source column ${foreignKey.tableName}.${column}`, table.columns.has(column));
    }
  }

  if (referencedTable) {
    for (const column of foreignKey.referencedColumns) {
      check(results, `${foreignKey.fileName}:${foreignKey.constraintName} references existing target column ${foreignKey.referencedTableName}.${column}`, referencedTable.columns.has(column));
    }
  }
}

for (const trigger of triggers) {
  check(results, `${trigger.fileName}:${trigger.triggerName} targets existing table ${trigger.tableName}`, tables.has(trigger.tableName) || trigger.tableName === "config_tenants");
  check(results, `${trigger.fileName}:${trigger.triggerName} executes existing function ${trigger.functionName}`, functions.has(trigger.functionName));
}

for (const token of ["tenant_id", "configuration_version_id", "status text not null", "metadata_json jsonb", "created_at timestamptz", "created_by uuid", "archived_at timestamptz"]) {
  check(results, `common authority column/static contract: ${token}`, normalized.includes(token));
}

for (const fileName of expectedConfigurationMigrations) {
  const fileSql = readMigration(fileName);
  check(results, `${fileName} includes local-only guard comment`, fileSql.toLowerCase().includes("local file creation only"));
}

const forbiddenTableFamilies = [
  /^p1_01b_3/,
  /^award_validation/,
  /^project_readiness/,
  /^mobilization/,
  /^configuration_studio/,
  /^runtime_template/,
];
const createdTables = createdTableNames(sql);
const forbiddenCreated = createdTables.filter((table) => forbiddenTableFamilies.some((pattern) => pattern.test(table)));
check(results, "no P1-01B.3/project readiness/mobilization/runtime Studio tables created", forbiddenCreated.length === 0, forbiddenCreated.join(", "));

check(results, "JSONB validation checks exist", normalized.includes("jsonb_typeof"));
check(results, "explicit constraints are present", normalized.includes("constraint config_"));
check(results, "explicit indexes are present", normalized.includes("create index if not exists"));

for (const invariant of [
  "config_tenant_configurations_activation_tenant_fkey",
  "config_tenant_configurations_active_version_id_fkey",
  "config_configuration_versions_base_same_configuration_fkey",
  "config_configuration_versions_rollback_same_configuration_fkey",
  "config_configuration_versions_source_same_configuration_fkey",
  "config_gate_definitions_phase_same_configuration_fkey",
  "config_gate_questions_gate_same_configuration_fkey",
  "config_gate_evidence_requirements_gate_same_configuration_fkey",
  "config_gate_decision_outcomes_gate_same_configuration_fkey",
  "config_decision_right_definitions_role_same_configuration_fkey",
  "config_decision_right_definitions_permission_same_configuration_fkey",
  "config_decision_right_definitions_gate_same_configuration_fkey",
  "config_artifact_type_definitions_phase_same_configuration_fkey",
  "config_evidence_type_definitions_artifact_same_configuration_fkey",
  "config_gate_evidence_requirements_evidence_type_id_fkey",
  "config_gate_decision_outcomes_target_gate_same_configuration_fkey",
  "config_gate_evidence_requirements_applies_to_class_same_configuration_fkey",
  "config_workstreams_owner_role_same_configuration_fkey",
  "config_service_lanes_owner_role_same_configuration_fkey",
  "config_decision_right_definitions_outcome_same_gate_fkey",
  "config_artifact_type_definitions_owner_role_same_configuration_fkey",
  "config_artifact_type_definitions_approver_role_same_configuration_fkey",
  "config_evidence_type_definitions_owner_role_same_configuration_fkey",
  "config_evidence_type_definitions_approver_role_same_configuration_fkey",
  "config_kpi_definitions_owner_role_same_configuration_fkey",
  "config_handoff_definitions_sending_role_same_configuration_fkey",
  "config_handoff_definitions_receiving_role_same_configuration_fkey",
  "config_workforce_gate_dependency_links_rule_same_configuration_fkey",
  "config_workforce_gate_dependency_links_gate_same_configuration_fkey",
  "config_handoff_required_evidence_links_handoff_same_configuration_fkey",
  "config_handoff_required_evidence_links_evidence_same_configuration_fkey",
  "config_governance_forum_participant_role_links_forum_same_configuration_fkey",
  "config_governance_forum_participant_role_links_role_same_configuration_fkey",
  "config_governance_forum_kpi_links_forum_same_configuration_fkey",
  "config_governance_forum_kpi_links_kpi_same_configuration_fkey",
  "config_exception_approval_role_links_exception_same_configuration_fkey",
  "config_exception_approval_role_links_role_same_configuration_fkey",
]) {
  check(results, `required tenant/version invariant exists: ${invariant}`, normalized.includes(invariant));
}

const requiredForeignKeys = [
  {
    name: "config_tenant_configurations_activation_tenant_fkey",
    tableName: "config_tenant_configurations",
    columns: ["activation_id", "tenant_id"],
    referencedTableName: "config_tenant_template_activations",
    referencedColumns: ["id", "tenant_id"],
  },
  {
    name: "config_gate_decision_outcomes_target_gate_same_configuration_fkey",
    tableName: "config_gate_decision_outcomes",
    columns: ["configuration_version_id", "target_gate_key"],
    referencedTableName: "config_gate_definitions",
    referencedColumns: ["configuration_version_id", "gate_key"],
  },
  {
    name: "config_gate_evidence_requirements_applies_to_class_same_configuration_fkey",
    tableName: "config_gate_evidence_requirements",
    columns: ["configuration_version_id", "applies_to_class_key"],
    referencedTableName: "config_work_class_definitions",
    referencedColumns: ["configuration_version_id", "work_class_key"],
  },
  {
    name: "config_workstreams_owner_role_same_configuration_fkey",
    tableName: "config_workstreams",
    columns: ["configuration_version_id", "owner_role_key"],
    referencedTableName: "config_role_definitions",
    referencedColumns: ["configuration_version_id", "role_key"],
  },
  {
    name: "config_handoff_required_evidence_links_evidence_same_configuration_fkey",
    tableName: "config_handoff_required_evidence_links",
    columns: ["configuration_version_id", "evidence_type_key"],
    referencedTableName: "config_evidence_type_definitions",
    referencedColumns: ["configuration_version_id", "evidence_type_key"],
  },
  {
    name: "config_governance_forum_participant_role_links_role_same_configuration_fkey",
    tableName: "config_governance_forum_participant_role_links",
    columns: ["configuration_version_id", "role_key"],
    referencedTableName: "config_role_definitions",
    referencedColumns: ["configuration_version_id", "role_key"],
  },
  {
    name: "config_governance_forum_kpi_links_kpi_same_configuration_fkey",
    tableName: "config_governance_forum_kpi_links",
    columns: ["configuration_version_id", "kpi_key"],
    referencedTableName: "config_kpi_definitions",
    referencedColumns: ["configuration_version_id", "kpi_key"],
  },
];

for (const required of requiredForeignKeys) {
  const match = foreignKeys.find((foreignKey) =>
    foreignKey.constraintName === required.name
    && foreignKey.tableName === required.tableName
    && foreignKey.referencedTableName === required.referencedTableName
    && JSON.stringify(foreignKey.columns) === JSON.stringify(required.columns)
    && JSON.stringify(foreignKey.referencedColumns) === JSON.stringify(required.referencedColumns)
  );
  check(results, `required structural FK shape exists: ${required.name}`, Boolean(match));
}

for (const emptyAuthorityField of [
  "config_governance_forum_definitions_participant_roles_empty_check",
  "config_governance_forum_definitions_linked_kpi_json_empty_check",
  "config_handoff_definitions_required_evidence_json_empty_check",
  "config_workforce_qualification_rules_gate_json_empty_check",
  "config_exception_rules_approval_json_empty_check",
]) {
  check(results, `authority array/JSON placeholder is constrained empty: ${emptyAuthorityField}`, normalized.includes(emptyAuthorityField));
}

finish(results, "Configuration Foundation schema static verification");
