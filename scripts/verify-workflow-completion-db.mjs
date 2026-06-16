import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(".env.local");

const requiredMode = process.env.RYBEXOS_DATA_SOURCE === "database";
const requiredStore = process.env.RYBEXOS_WORKFLOW_COMPLETION_STORE === "database";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKeySource = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    : null;
const secretKeySource = process.env.SUPABASE_SECRET_KEY
  ? "SUPABASE_SECRET_KEY"
  : process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "SUPABASE_SERVICE_ROLE_KEY"
    : null;
const publishableKey = publishableKeySource ? process.env[publishableKeySource] : undefined;
const secretKey = secretKeySource ? process.env[secretKeySource] : undefined;
const failures = [];

if (!requiredMode) failures.push("Set RYBEXOS_DATA_SOURCE=database.");
if (!requiredStore) failures.push("Set RYBEXOS_WORKFLOW_COMPLETION_STORE=database.");
if (!supabaseUrl || isPlaceholder(supabaseUrl)) failures.push("Set NEXT_PUBLIC_SUPABASE_URL.");
if (!publishableKey || isPlaceholder(publishableKey)) failures.push("Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
if (!secretKey || isPlaceholder(secretKey)) failures.push("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY for server-side write verification.");

if (failures.length > 0) {
  console.error("Workflow completion DB verification cannot run:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
const headers = createHeaders(secretKey);
const workflow = {
  workflowId: "billing-backup-cash-recovery",
  completionItemId: "billing-billing-backup-cash-recovery",
  sourceModule: "billing",
  sourceRecordType: "billing_backup_item",
  sourceRecordId: "bb-lake-001",
  title: "Add missing billing backup",
  fromStatus: "waiting_on_evidence",
  toStatus: "evidence_attached",
  fromResolution: "evidence_required",
  toResolution: "review_required",
  actionType: "mark_evidence_attached",
  actionLabel: "Mark backup attached",
  message: "Backup marked attached. Next: send to review.",
  nextStep: "Send the billing backup to review."
};

main().catch((error) => {
  console.error(formatVerifierError(error));
  process.exitCode = 1;
});

async function main() {
  await verifySupabaseKeys();
  await verifyColumns();

  const context = await resolveContext();
  const before = await getCounts();
  const instance = await findOrCreateCompletionWorkflowInstance(context);
  const previousStatus = instance.current_status ?? workflow.fromStatus;
  const previousResolution = instance.resolution_state ?? workflow.fromResolution;
  const timestamp = new Date().toISOString();

  const evidence = await findOrCreateEvidenceRequirement(instance, context, timestamp);
  await updateRows("workflow_evidence_requirements", { id: `eq.${evidence.id}` }, {
    status: "uploaded",
    updated_at: timestamp
  });

  const transaction = await insertRow("workflow_transactions", {
    organization_id: instance.organization_id,
    workspace_id: instance.workspace_id,
    project_id: instance.project_id,
    workflow_instance_id: instance.id,
    transaction_type: workflow.actionType,
    transaction_label: workflow.actionLabel,
    actor_name: "RybexOS Completion Verification",
    actor_role: "admin",
    actor_user_id: null,
    decision: workflow.actionType,
    decision_reason: "Database workflow completion pilot verification.",
    action_taken: workflow.actionLabel,
    evidence_summary: "Product approval backup",
    resulting_status: workflow.toStatus,
    resulting_resolution_state: workflow.toResolution,
    resulting_gate_movement: workflow.nextStep,
    success_message: workflow.message,
    metadata: {
      rybexos_completion_pilot: true,
      verification: true,
      completionWorkflowId: workflow.workflowId,
      completionItemId: workflow.completionItemId,
      evidenceUpdate: {
        status: "uploaded",
        requirementIds: [evidence.id],
        metadataOnly: false
      },
      cleanupHint: "Rows are intentionally labeled rybexos_completion_pilot=true for manual cleanup if desired."
    },
    created_at: timestamp
  });

  await updateRows("workflow_instances", { id: `eq.${instance.id}` }, {
    current_status: workflow.toStatus,
    resolution_state: workflow.toResolution,
    next_gate_or_status: workflow.nextStep,
    updated_at: timestamp,
    metadata: {
      ...(instance.metadata ?? {}),
      rybexos_completion_pilot: true,
      verification: true,
      completionWorkflowId: workflow.workflowId,
      completionItemId: workflow.completionItemId,
      lastCompletionTransactionId: transaction.id,
      lastCompletionActionType: workflow.actionType,
      nextStep: workflow.nextStep
    }
  });

  const audit = await insertRow("audit_events", {
    organization_id: instance.organization_id,
    workspace_id: instance.workspace_id,
    project_id: instance.project_id,
    entity_type: "workflow_completion_item",
    entity_id: instance.id,
    action: workflow.actionType,
    actor_role: "admin",
    actor_name: "RybexOS Completion Verification",
    actor_user_id: null,
    summary: workflow.message,
    before_state: {
      status: previousStatus,
      resolutionState: previousResolution
    },
    after_state: {
      status: workflow.toStatus,
      resolutionState: workflow.toResolution,
      evidenceRequirementId: evidence.id
    },
    severity: "info",
    metadata: {
      rybexos_completion_pilot: true,
      verification: true,
      workflowTransactionId: transaction.id,
      completionWorkflowId: workflow.workflowId
    },
    created_at: timestamp
  });

  const statusHistory = await insertRow("status_history", {
    organization_id: instance.organization_id,
    workspace_id: instance.workspace_id,
    project_id: instance.project_id,
    entity_type: "workflow_completion_item",
    entity_id: instance.id,
    from_status: `${previousStatus}/${previousResolution}`,
    to_status: `${workflow.toStatus}/${workflow.toResolution}`,
    changed_by: null,
    changed_at: timestamp,
    reason: "Workflow completion DB pilot verification.",
    related_audit_event_id: audit.id,
    metadata: {
      rybexos_completion_pilot: true,
      verification: true,
      workflowTransactionId: transaction.id,
      completionWorkflowId: workflow.workflowId
    }
  });

  const after = await getCounts();
  const transactionIncreased = after.workflowTransactions > before.workflowTransactions;
  const auditIncreased = after.auditEvents > before.auditEvents;
  const statusIncreased = after.statusHistory > before.statusHistory;

  if (!transactionIncreased || !auditIncreased || !statusIncreased) {
    console.error("Workflow completion DB verification failed: counts did not increase as expected.");
    console.error(JSON.stringify({ before, after }, null, 2));
    process.exit(1);
  }

  console.log("Workflow completion DB verification passed.");
  console.log(`workflow_instances: ${before.workflowInstances} -> ${after.workflowInstances}`);
  console.log(`workflow_transactions: ${before.workflowTransactions} -> ${after.workflowTransactions}`);
  console.log(`audit_events: ${before.auditEvents} -> ${after.auditEvents}`);
  console.log(`status_history: ${before.statusHistory} -> ${after.statusHistory}`);
  console.log(`workflow_evidence_requirements: ${before.evidenceRequirements} -> ${after.evidenceRequirements}`);
  console.log(`completion workflow_instance_id: ${instance.id}`);
  console.log(`completion workflow_transaction_id: ${transaction.id}`);
  console.log(`completion audit_event_id: ${audit.id}`);
  console.log(`completion status_history_id: ${statusHistory.id}`);
  console.log(`completion evidence_requirement_id: ${evidence.id}`);
}

async function verifySupabaseKeys() {
  await probeRestApi({
    key: publishableKey,
    source: publishableKeySource,
    purpose: "read"
  });

  await probeRestApi({
    key: secretKey,
    source: secretKeySource,
    purpose: "server-side write"
  });
}

async function probeRestApi({ key, source, purpose }) {
  const url = new URL(`${restUrl}/workflow_instances`);
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: createHeaders(key),
    cache: "no-store"
  });

  if (response.status === 401) {
    const detail = await response.text().catch(() => "");
    throw new VerifierConfigurationError(
      `${source} is present but Supabase rejected it while checking ${purpose} access. Confirm the key belongs to ${supabaseUrl}, has not been rotated, and is copied into .env.local without quotes, angle brackets, or extra spaces.${detail ? ` Supabase response: ${safeSupabaseDetail(detail)}` : ""}`
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Key probe failed for ${source}: ${response.status} ${response.statusText}${detail ? ` - ${safeSupabaseDetail(detail)}` : ""}`);
  }
}

async function verifyColumns() {
  await Promise.all([
    readRows("workflow_instances", {
      select: "id,organization_id,workspace_id,project_id,current_status,resolution_state,metadata",
      limit: "1"
    }),
    readRows("workflow_transactions", {
      select: "id,workflow_instance_id,transaction_type,metadata,created_at",
      limit: "1"
    }),
    readRows("workflow_evidence_requirements", {
      select: "id,workflow_instance_id,title,status",
      limit: "1"
    }),
    readRows("audit_events", {
      select: "id,project_id,entity_type,entity_id,action,metadata",
      limit: "1"
    }),
    readRows("status_history", {
      select: "id,project_id,entity_type,entity_id,from_status,to_status,related_audit_event_id,metadata",
      limit: "1"
    })
  ]);
}

async function resolveContext() {
  const [existingWorkflow] = await readRows("workflow_instances", {
    select: "organization_id,workspace_id,project_id",
    limit: "1"
  });

  if (existingWorkflow) {
    return {
      organizationId: existingWorkflow.organization_id,
      workspaceId: existingWorkflow.workspace_id,
      projectId: existingWorkflow.project_id ?? null
    };
  }

  const [workspace] = await readRows("workspaces", {
    select: "id,organization_id",
    limit: "1"
  });

  if (!workspace) {
    throw new Error("No workspace row found. Seed the Supabase foundation before running the completion DB verifier.");
  }

  return {
    organizationId: workspace.organization_id,
    workspaceId: workspace.id,
    projectId: null
  };
}

async function findOrCreateCompletionWorkflowInstance(context) {
  const [existing] = await readRows("workflow_instances", {
    select: "id,organization_id,workspace_id,project_id,current_status,resolution_state,metadata",
    source_module: `eq.${workflow.sourceModule}`,
    source_record_type: `eq.${workflow.sourceRecordType}`,
    source_record_id: `eq.${workflow.sourceRecordId}`,
    limit: "1"
  });

  if (existing) return existing;

  return insertRow("workflow_instances", {
    organization_id: context.organizationId,
    workspace_id: context.workspaceId,
    project_id: context.projectId,
    workflow_type: "billing_backup_blocker",
    d5o_phase: "D4",
    source_module: workflow.sourceModule,
    source_record_type: workflow.sourceRecordType,
    source_record_id: workflow.sourceRecordId,
    entity_name: workflow.title,
    title: workflow.title,
    description: "Completion pilot workflow instance for billing backup proof.",
    current_status: workflow.fromStatus,
    resolution_state: workflow.fromResolution,
    severity: "high",
    owner_name: "Finance / PM",
    owner_role: "Finance / PM",
    due_date: new Date().toISOString(),
    business_impact: "Pay application cannot move until required backup is complete.",
    consequence_if_missed: "Cash recovery is delayed.",
    target_module: "billing",
    target_href: "/billing?focus=billing-billing-backup-cash-recovery#focused-task",
    next_gate_or_status: "Send the billing backup to review.",
    value_at_risk: 84000,
    metadata: {
      rybexos_completion_pilot: true,
      verification: true,
      completionWorkflowId: workflow.workflowId,
      completionItemId: workflow.completionItemId
    }
  });
}

async function findOrCreateEvidenceRequirement(instance, context, timestamp) {
  const [existing] = await readRows("workflow_evidence_requirements", {
    select: "id,title,status",
    workflow_instance_id: `eq.${instance.id}`,
    title: "eq.Product approval backup",
    limit: "1"
  });

  if (existing) return existing;

  return insertRow("workflow_evidence_requirements", {
    organization_id: instance.organization_id ?? context.organizationId,
    workspace_id: instance.workspace_id ?? context.workspaceId,
    workflow_instance_id: instance.id,
    requirement_type: "billing_backup_item",
    title: "Product approval backup",
    description: "Completion pilot evidence requirement for billing backup.",
    status: "missing",
    source_module: "billing",
    source_record_type: "billing_backup_item",
    source_record_id: "bb-lake-001",
    attachment_id: null,
    required_for_gate: true,
    created_at: timestamp,
    updated_at: timestamp
  });
}

async function getCounts() {
  const [workflowInstances, workflowTransactions, auditEvents, statusHistory, evidenceRequirements] = await Promise.all([
    readRows("workflow_instances", { select: "id", limit: "10000" }),
    readRows("workflow_transactions", { select: "id", limit: "10000" }),
    readRows("audit_events", { select: "id", limit: "10000" }),
    readRows("status_history", { select: "id", limit: "10000" }),
    readRows("workflow_evidence_requirements", { select: "id", limit: "10000" })
  ]);

  return {
    workflowInstances: workflowInstances.length,
    workflowTransactions: workflowTransactions.length,
    auditEvents: auditEvents.length,
    statusHistory: statusHistory.length,
    evidenceRequirements: evidenceRequirements.length
  };
}

async function readRows(table, params = {}) {
  const url = new URL(`${restUrl}/${table}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Read failed for ${table}: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  return response.json();
}

async function insertRow(table, payload) {
  const response = await fetch(`${restUrl}/${table}`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Insert failed for ${table}: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  const rows = await response.json();
  return rows[0];
}

async function updateRows(table, filters, payload) {
  const url = new URL(`${restUrl}/${table}`);
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Update failed for ${table}: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  return response.json();
}

function isPlaceholder(value) {
  return /^<.*>$/.test(value.trim()) || /your-|placeholder|changeme|provided|example|paste_/i.test(value);
}

function createHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

function formatVerifierError(error) {
  if (error instanceof VerifierConfigurationError) {
    return `Workflow completion DB verification cannot run:\n- ${error.message}`;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("401 Unauthorized") || message.includes("Invalid API key")) {
    return [
      "Workflow completion DB verification cannot run:",
      `- Supabase rejected the configured API key. Check ${secretKeySource ?? "SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY"} and ${publishableKeySource ?? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY"} in .env.local.`,
      "- The verifier does not print key values. Rotate or replace local keys if they may be stale."
    ].join("\n");
  }

  return `Workflow completion DB verification failed:\n- ${message}`;
}

function safeSupabaseDetail(detail) {
  return detail.replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-token]").replace(/sb_[A-Za-z0-9._-]+/g, "[redacted-key]");
}

class VerifierConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "VerifierConfigurationError";
  }
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) return;

  const source = readFileSync(filePath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}
