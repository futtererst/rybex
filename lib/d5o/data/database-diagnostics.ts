import { getDataSourceMode, isDatabaseMode, isSeedMode } from "./data-source";
import { readSupabaseTable } from "./database-client";
import { getWorkflowTransactionStoreMode } from "../workflow/transaction-store";

const trackedDatabaseEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;
const optionalDatabaseEnv = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export type DatabaseReadinessStatus = {
  dataSourceMode: ReturnType<typeof getDataSourceMode>;
  workflowTransactionStoreMode: ReturnType<typeof getWorkflowTransactionStoreMode>;
  runtimeEnabled: boolean;
  databaseEnvRequired: boolean;
  requiredEnvPresent: string[];
  requiredEnvMissing: string[];
  optionalEnvPresent: string[];
  optionalEnvMissing: string[];
  supabaseUrlPresent: boolean;
  supabasePublishableKeyPresent: boolean;
  supabaseAnonKeyPresent: boolean;
  supabaseSecretKeyPresent: boolean;
  supabaseServiceRoleKeyPresent: boolean;
  databaseReadPilotReady: boolean;
  seedFallbackActive: boolean;
  repositoryStatus: "seed_active" | "database_ready_for_pilot" | "database_env_missing";
  migrationsExpected: string[];
  message: string;
};

export type DatabasePilotCounts = {
  status: "seed_mode" | "ready" | "env_missing" | "read_failed";
  workflowInstanceCount?: number;
  workflowTransactionCount?: number;
  auditEventCount?: number;
  statusHistoryCount?: number;
  lastWorkflowTransactionCreatedAt?: string;
  opportunityCount?: number;
  projectCount?: number;
  message: string;
};

export function validateDatabaseEnv() {
  const supabaseUrlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKeyPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const supabaseAnonKeyPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabaseSecretKeyPresent = Boolean(process.env.SUPABASE_SECRET_KEY);
  const supabaseServiceRoleKeyPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasReadKey =
    supabasePublishableKeyPresent ||
    supabaseAnonKeyPresent ||
    supabaseSecretKeyPresent ||
    supabaseServiceRoleKeyPresent;
  const requiredEnvPresent = trackedDatabaseEnv.filter((key) => {
    if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY" || key === "SUPABASE_SERVICE_ROLE_KEY") {
      return false;
    }

    return Boolean(process.env[key]);
  });
  const requiredEnvMissing = [
    !supabaseUrlPresent ? "NEXT_PUBLIC_SUPABASE_URL" : "",
    !hasReadKey ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or compatible read key" : ""
  ].filter(Boolean);
  const optionalEnvPresent = optionalDatabaseEnv.filter((key) => Boolean(process.env[key]));
  const optionalEnvMissing = optionalDatabaseEnv.filter((key) => !process.env[key]);

  return {
    requiredEnvPresent,
    requiredEnvMissing,
    optionalEnvPresent,
    optionalEnvMissing,
    supabaseUrlPresent,
    supabasePublishableKeyPresent,
    supabaseAnonKeyPresent,
    supabaseSecretKeyPresent,
    supabaseServiceRoleKeyPresent,
    databaseReadPilotReady: supabaseUrlPresent && hasReadKey
  };
}

export function getDatabaseReadinessStatus(): DatabaseReadinessStatus {
  const env = validateDatabaseEnv();

  if (isSeedMode()) {
    return {
      dataSourceMode: getDataSourceMode(),
      workflowTransactionStoreMode: getWorkflowTransactionStoreMode(),
      runtimeEnabled: false,
      databaseEnvRequired: false,
      ...env,
      seedFallbackActive: true,
      repositoryStatus: "seed_active",
      migrationsExpected: [
        "supabase/migrations/0001_core_foundation.sql",
        "supabase/migrations/0002_d1_d2_pipeline_projects.sql",
        "supabase/migrations/0003_workflow_transactions.sql"
      ],
      message: "Seed mode is active. Database env vars are not required for build, demo, or route smoke checks."
    };
  }

  const repositoryStatus = env.requiredEnvMissing.length > 0 ? "database_env_missing" : "database_ready_for_pilot";

  return {
    dataSourceMode: getDataSourceMode(),
    workflowTransactionStoreMode: getWorkflowTransactionStoreMode(),
    runtimeEnabled: isDatabaseMode(),
    databaseEnvRequired: true,
    ...env,
    seedFallbackActive: false,
    repositoryStatus,
    migrationsExpected: [
      "supabase/migrations/0001_core_foundation.sql",
      "supabase/migrations/0002_d1_d2_pipeline_projects.sql",
      "supabase/migrations/0003_workflow_transactions.sql"
    ],
    message:
      repositoryStatus === "database_ready_for_pilot"
        ? "Database mode has the Supabase env needed for a narrow read-only pilot. Writes, auth, and RLS remain disabled."
        : "Database mode was requested, but required env vars are missing."
  };
}

export async function getDatabasePilotCounts(): Promise<DatabasePilotCounts> {
  const readiness = getDatabaseReadinessStatus();

  if (!isDatabaseMode()) {
    return {
      status: "seed_mode",
      message: "Seed mode is active. Database counts are skipped."
    };
  }

  if (!readiness.databaseReadPilotReady) {
    return {
      status: "env_missing",
      message: "Database mode is active, but Supabase read env vars are incomplete."
    };
  }

  try {
    const [workflowInstances, workflowTransactions, auditEvents, statusHistory, opportunities, projects] = await Promise.all([
      readSupabaseTable<{ id: string }>("workflow_instances", { select: "id", limit: 1000 }),
      readSupabaseTable<{ id: string; created_at: string }>("workflow_transactions", { select: "id,created_at", order: "created_at.desc", limit: 1000 }),
      readSupabaseTable<{ id: string }>("audit_events", { select: "id", limit: 1000 }),
      readSupabaseTable<{ id: string }>("status_history", { select: "id", limit: 1000 }),
      readSupabaseTable<{ id: string }>("opportunities", { select: "id", limit: 1000 }),
      readSupabaseTable<{ id: string }>("projects", { select: "id", limit: 1000 })
    ]);

    return {
      status: "ready",
      workflowInstanceCount: workflowInstances.length,
      workflowTransactionCount: workflowTransactions.length,
      auditEventCount: auditEvents.length,
      statusHistoryCount: statusHistory.length,
      lastWorkflowTransactionCreatedAt: workflowTransactions[0]?.created_at,
      opportunityCount: opportunities.length,
      projectCount: projects.length,
      message: "Database read pilot responded successfully."
    };
  } catch (error) {
    return {
      status: "read_failed",
      message: error instanceof Error ? error.message : "Database read pilot failed."
    };
  }
}
