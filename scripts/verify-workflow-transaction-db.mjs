import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(".env.local");

const requiredMode = process.env.RYBEXOS_DATA_SOURCE === "database";
const requiredStore = process.env.RYBEXOS_WORKFLOW_TRANSACTION_STORE === "database";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const failures = [];

if (!requiredMode) {
  failures.push("Set RYBEXOS_DATA_SOURCE=database.");
}

if (!requiredStore) {
  failures.push("Set RYBEXOS_WORKFLOW_TRANSACTION_STORE=database.");
}

if (!supabaseUrl) {
  failures.push("Set NEXT_PUBLIC_SUPABASE_URL.");
}

if (!secretKey) {
  failures.push("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY for server-side write verification.");
}

if (failures.length > 0) {
  console.error("Workflow transaction DB verification cannot run:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  "Content-Type": "application/json"
};

const before = await getCounts();
const [workflow] = await readRows("workflow_instances", {
  select: "id,organization_id,workspace_id,project_id,current_status,resolution_state,severity,title",
  order: "due_date.asc.nullslast",
  limit: "1"
});

if (!workflow) {
  console.error("No workflow_instances rows found. Apply/seed the Phase 3 workflow transaction schema before running this check.");
  process.exit(1);
}

const timestamp = new Date().toISOString();
const nextStatus = workflow.current_status === "ready_for_review" ? "active" : "ready_for_review";
const nextResolution = workflow.resolution_state === "ready_for_review" ? "in_progress" : "ready_for_review";
const transaction = await insertRow("workflow_transactions", {
  organization_id: workflow.organization_id,
  workspace_id: workflow.workspace_id,
  project_id: workflow.project_id,
  workflow_instance_id: workflow.id,
  transaction_type: "resolve_workflow_action",
  transaction_label: "Verification Workflow Transaction",
  actor_name: "RybexOS Verification",
  actor_role: "admin",
  actor_user_id: null,
  decision: "verification",
  decision_reason: "Database workflow transaction write pilot verification.",
  action_taken: "Inserted verification workflow transaction through scripts/verify-workflow-transaction-db.mjs.",
  evidence_summary: "Verification script confirmed workflow transaction write path.",
  resulting_status: nextStatus,
  resulting_resolution_state: nextResolution,
  resulting_gate_movement: "Verification transaction moved workflow pilot status.",
  success_message: "Verification workflow transaction inserted.",
  metadata: {
    verification: true,
    cleanupHint: "Rows are intentionally labeled verification=true for manual cleanup if desired."
  },
  created_at: timestamp
});

await updateRows("workflow_instances", { id: `eq.${workflow.id}` }, {
  current_status: nextStatus,
  resolution_state: nextResolution,
  updated_at: timestamp,
  metadata: {
    verificationLastTransactionId: transaction.id,
    verificationUpdatedAt: timestamp
  }
});

const audit = await insertRow("audit_events", {
  organization_id: workflow.organization_id,
  workspace_id: workflow.workspace_id,
  project_id: workflow.project_id,
  entity_type: "workflow_instance",
  entity_id: workflow.id,
  action: "workflow_transaction_verification",
  actor_role: "admin",
  actor_name: "RybexOS Verification",
  actor_user_id: null,
  summary: `Verification workflow transaction inserted for ${workflow.title}.`,
  before_state: {
    currentStatus: workflow.current_status,
    resolutionState: workflow.resolution_state
  },
  after_state: {
    currentStatus: nextStatus,
    resolutionState: nextResolution
  },
  severity: "info",
  metadata: {
    verification: true,
    workflowTransactionId: transaction.id
  },
  created_at: timestamp
});

const statusHistory = await insertRow("status_history", {
  organization_id: workflow.organization_id,
  workspace_id: workflow.workspace_id,
  project_id: workflow.project_id,
  entity_type: "workflow_instance",
  entity_id: workflow.id,
  from_status: `${workflow.current_status}/${workflow.resolution_state}`,
  to_status: `${nextStatus}/${nextResolution}`,
  changed_by: null,
  changed_at: timestamp,
  reason: "Workflow transaction DB verification.",
  related_audit_event_id: audit.id,
  metadata: {
    verification: true,
    workflowTransactionId: transaction.id
  }
});

const after = await getCounts();

console.log("Workflow transaction DB verification passed.");
console.log(`workflow_instances: ${before.workflowInstances} -> ${after.workflowInstances}`);
console.log(`workflow_transactions: ${before.workflowTransactions} -> ${after.workflowTransactions}`);
console.log(`audit_events: ${before.auditEvents} -> ${after.auditEvents}`);
console.log(`status_history: ${before.statusHistory} -> ${after.statusHistory}`);
console.log(`verification workflow_instance_id: ${workflow.id}`);
console.log(`verification workflow_transaction_id: ${transaction.id}`);
console.log(`verification audit_event_id: ${audit.id}`);
console.log(`verification status_history_id: ${statusHistory.id}`);

async function getCounts() {
  const [workflowInstances, workflowTransactions, auditEvents, statusHistory] = await Promise.all([
    readRows("workflow_instances", { select: "id", limit: "10000" }),
    readRows("workflow_transactions", { select: "id", limit: "10000" }),
    readRows("audit_events", { select: "id", limit: "10000" }),
    readRows("status_history", { select: "id", limit: "10000" })
  ]);

  return {
    workflowInstances: workflowInstances.length,
    workflowTransactions: workflowTransactions.length,
    auditEvents: auditEvents.length,
    statusHistory: statusHistory.length
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
    throw new Error(`Read failed for ${table}: ${response.status} ${response.statusText}`);
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

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const source = readFileSync(filePath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}
