import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(".env.local");

const bucket = "rybexos-evidence";
const requiredMode = process.env.RYBEXOS_DATA_SOURCE === "database";
const requiredStore = process.env.RYBEXOS_EVIDENCE_STORE === "database";
const allowWriteTest = process.env.RYBEXOS_ALLOW_EVIDENCE_UPLOAD_TEST === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const failures = [];

if (!requiredMode) {
  failures.push("Set RYBEXOS_DATA_SOURCE=database.");
}

if (!requiredStore) {
  failures.push("Set RYBEXOS_EVIDENCE_STORE=database.");
}

if (!supabaseUrl) {
  failures.push("Set NEXT_PUBLIC_SUPABASE_URL.");
}

if (!secretKey) {
  failures.push("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY for server-side Storage verification.");
}

if (failures.length > 0) {
  console.error("Evidence upload pilot verification cannot run:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
const storageUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1`;
const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  "Content-Type": "application/json"
};

const before = await getCounts();
const bucketStatus = await checkBucket();
const [requirement] = await readRows("workflow_evidence_requirements", {
  select: "id,organization_id,workspace_id,workflow_instance_id,status,title",
  limit: "1"
});

if (!requirement) {
  console.error("No workflow_evidence_requirements rows found. Seed the workflow transaction/evidence pilot before running this check.");
  process.exit(1);
}

const [workflow] = await readRows("workflow_instances", {
  select: "id,project_id",
  id: `eq.${requirement.workflow_instance_id}`,
  limit: "1"
});

if (!workflow) {
  console.error(`No workflow_instances row found for evidence requirement ${requirement.id}.`);
  process.exit(1);
}

if (!allowWriteTest) {
  console.log("Evidence upload pilot dry-run passed.");
  console.log(`Bucket check: ${bucketStatus}`);
  console.log(`workflow_evidence_requirements: ${before.evidenceRequirements}`);
  console.log(`attachments: ${before.attachments}`);
  console.log(`entity_attachments: ${before.entityAttachments}`);
  console.log("Set RYBEXOS_ALLOW_EVIDENCE_UPLOAD_TEST=1 to upload a tiny verification file and insert pilot rows.");
  process.exit(0);
}

const timestamp = new Date().toISOString();
const fileName = `rybexos-evidence-upload-verification-${Date.now()}.txt`;
const storagePath = [
  requirement.organization_id,
  requirement.workspace_id,
  workflow.project_id ?? "no-project",
  requirement.id,
  fileName
].join("/");
const fileBody = new Blob([
  `RybexOS evidence upload pilot verification.\nCreated at: ${timestamp}\n`
], { type: "text/plain" });

await uploadObject(storagePath, fileBody);

const attachment = await insertRow("attachments", {
  organization_id: requirement.organization_id,
  workspace_id: requirement.workspace_id,
  project_id: workflow.project_id,
  storage_provider: "supabase_storage",
  bucket,
  storage_path: storagePath,
  file_name: fileName,
  mime_type: "text/plain",
  file_size_bytes: fileBody.size,
  status: "active",
  is_private: true,
  virus_scan_status: "not_scanned",
  metadata: {
    verification: true,
    evidenceRequirementId: requirement.id
  },
  created_by: null,
  updated_by: null
});

const entityAttachment = await insertRow("entity_attachments", {
  organization_id: requirement.organization_id,
  workspace_id: requirement.workspace_id,
  project_id: workflow.project_id,
  entity_type: "workflow_evidence_requirement",
  entity_id: requirement.id,
  attachment_id: attachment.id,
  relationship_type: "evidence",
  metadata: {
    verification: true
  },
  created_by: null,
  updated_by: null
});

await updateRows("workflow_evidence_requirements", { id: `eq.${requirement.id}` }, {
  status: "uploaded",
  attachment_id: attachment.id,
  updated_at: timestamp
});

const audit = await insertRow("audit_events", {
  organization_id: requirement.organization_id,
  workspace_id: requirement.workspace_id,
  project_id: workflow.project_id,
  entity_type: "workflow_evidence_requirement",
  entity_id: requirement.id,
  action: "evidence_upload_verification",
  actor_role: "admin",
  actor_name: "RybexOS Verification",
  actor_user_id: null,
  summary: `Evidence upload pilot verified for ${requirement.title}.`,
  before_state: { status: requirement.status },
  after_state: { status: "uploaded", attachmentId: attachment.id },
  severity: "info",
  metadata: {
    verification: true,
    attachmentId: attachment.id,
    storageBucket: bucket,
    storagePath
  },
  created_at: timestamp
});

const statusHistory = await insertRow("status_history", {
  organization_id: requirement.organization_id,
  workspace_id: requirement.workspace_id,
  project_id: workflow.project_id,
  entity_type: "workflow_evidence_requirement",
  entity_id: requirement.id,
  from_status: requirement.status,
  to_status: "uploaded",
  changed_by: null,
  changed_at: timestamp,
  reason: "Evidence upload pilot verification.",
  related_audit_event_id: audit.id,
  metadata: {
    verification: true,
    attachmentId: attachment.id
  }
});

const after = await getCounts();

console.log("Evidence upload pilot verification passed.");
console.log(`Bucket check: ${bucketStatus}`);
console.log(`attachments: ${before.attachments} -> ${after.attachments}`);
console.log(`entity_attachments: ${before.entityAttachments} -> ${after.entityAttachments}`);
console.log(`audit_events: ${before.auditEvents} -> ${after.auditEvents}`);
console.log(`status_history: ${before.statusHistory} -> ${after.statusHistory}`);
console.log(`verification evidence_requirement_id: ${requirement.id}`);
console.log(`verification attachment_id: ${attachment.id}`);
console.log(`verification entity_attachment_id: ${entityAttachment.id}`);
console.log(`verification audit_event_id: ${audit.id}`);
console.log(`verification status_history_id: ${statusHistory.id}`);

async function getCounts() {
  const [evidenceRequirements, attachments, entityAttachments, auditEvents, statusHistory] = await Promise.all([
    readRows("workflow_evidence_requirements", { select: "id", limit: "10000" }),
    readRows("attachments", { select: "id", limit: "10000" }),
    readRows("entity_attachments", { select: "id", limit: "10000" }),
    readRows("audit_events", { select: "id", limit: "10000" }),
    readRows("status_history", { select: "id", limit: "10000" })
  ]);

  return {
    evidenceRequirements: evidenceRequirements.length,
    attachments: attachments.length,
    entityAttachments: entityAttachments.length,
    auditEvents: auditEvents.length,
    statusHistory: statusHistory.length
  };
}

async function checkBucket() {
  const response = await fetch(`${storageUrl}/bucket/${bucket}`, {
    headers,
    cache: "no-store"
  });

  if (response.ok) {
    return "available";
  }

  return `not confirmed (${response.status} ${response.statusText})`;
}

async function uploadObject(storagePath, body) {
  const cleanPath = storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const response = await fetch(`${storageUrl}/object/${encodeURIComponent(bucket)}/${cleanPath}`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "text/plain",
      "x-upsert": "false"
    },
    body
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Upload failed for ${bucket}/${storagePath}: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }
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
