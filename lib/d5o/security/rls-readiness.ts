import { getAuthMode } from "../auth/auth-mode";
import { getDataSourceMode } from "../data/data-source";
import { getDatabaseReadinessStatus } from "../data/database-diagnostics";
import { getEvidenceStoreMode } from "../evidence/evidence-store";
import { getWorkflowTransactionStoreMode } from "../workflow/transaction-store";
import { getRuntimeMode } from "./runtime-mode";

export type SecurityReadinessStatus = "not_enabled" | "scaffolded" | "enabled" | "unknown";

export type RlsReadiness = {
  appLevelRbac: "enabled";
  authMode: ReturnType<typeof getAuthMode>;
  dataSourceMode: ReturnType<typeof getDataSourceMode>;
  workflowTransactionStoreMode: ReturnType<typeof getWorkflowTransactionStoreMode>;
  runtimeMode: ReturnType<typeof getRuntimeMode>;
  databaseRls: SecurityReadinessStatus;
  rlsScaffoldStatus: "scaffolded" | "foundation_0a_enabled";
  helperFunctions: string[];
  scopedTables: string[];
  serviceRoleUsage: "server_only";
  clientSecretExposure: false;
  productionSecurityStatus: "not_ready";
  limitations: string[];
};

export type StorageSecurityReadiness = {
  evidenceStoreMode: ReturnType<typeof getEvidenceStoreMode>;
  expectedBucket: "rybexos-evidence";
  storageBucket: "configured_by_scaffold" | "unknown_until_db_inspection";
  storagePolicies: SecurityReadinessStatus;
  publicReadPolicy: false;
  signedUrls: "future";
  malwareScanning: "future";
  productionSecurityStatus: "not_ready";
  limitations: string[];
};

const helperFunctions = [
  "auth_user_profile_id",
  "auth_user_workspace_ids",
  "auth_user_role_keys",
  "is_workspace_member",
  "has_workspace_permission",
  "can_access_project",
  "can_access_workflow_instance",
  "can_access_evidence_requirement"
];

const scopedTables = [
  "organizations",
  "workspaces",
  "user_profiles",
  "workspace_memberships",
  "projects",
  "opportunities",
  "workflow_instances",
  "workflow_transactions",
  "workflow_evidence_requirements",
  "attachments",
  "entity_attachments",
  "audit_events",
  "status_history"
];

export function getRlsReadiness(): RlsReadiness {
  return {
    appLevelRbac: "enabled",
    authMode: getAuthMode(),
    dataSourceMode: getDataSourceMode(),
    workflowTransactionStoreMode: getWorkflowTransactionStoreMode(),
    runtimeMode: getRuntimeMode(),
    databaseRls: "scaffolded",
    rlsScaffoldStatus: "foundation_0a_enabled",
    helperFunctions,
    scopedTables,
    serviceRoleUsage: "server_only",
    clientSecretExposure: false,
    productionSecurityStatus: "not_ready",
    limitations: getSecurityLimitations()
  };
}

export function getStorageSecurityReadiness(): StorageSecurityReadiness {
  const databaseReadiness = getDatabaseReadinessStatus();

  return {
    evidenceStoreMode: getEvidenceStoreMode(),
    expectedBucket: "rybexos-evidence",
    storageBucket: databaseReadiness.databaseReadPilotReady ? "unknown_until_db_inspection" : "configured_by_scaffold",
    storagePolicies: "scaffolded",
    publicReadPolicy: false,
    signedUrls: "future",
    malwareScanning: "future",
    productionSecurityStatus: "not_ready",
    limitations: [
      "Evidence bucket is expected to be private.",
      "Storage policy examples are scaffolded but not enabled.",
      "Signed URL download flow is not implemented.",
      "Malware scanning is not integrated.",
      "Retention/archive enforcement is not implemented."
    ]
  };
}

export function getSecurityLimitations() {
  return [
    "Demo auth remains the default and does not require Supabase login.",
    "Supabase Auth session resolution is not production-ready.",
    "Foundation 0A identity/workspace RLS is defined in migration source; broad business-domain RLS is not enabled.",
    "Service role keys are used only from server-side actions/helpers.",
    "Workflow transaction writes and evidence uploads are narrow pilots, not broad production persistence.",
    "Storage policies require human review and database inspection before production use."
  ];
}
