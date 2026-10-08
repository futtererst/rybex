"use server";

import { getCurrentRybexUser, getDatabaseSafeActorUserId } from "@/lib/d5o/auth/current-user";
import { isDatabaseMode } from "@/lib/d5o/data/data-source";
import { insertSupabaseRow, readSupabaseTable, updateSupabaseRows, uploadSupabaseStorageObject } from "@/lib/d5o/data/database-client";
import { isDatabaseEvidenceStore } from "@/lib/d5o/evidence/evidence-store";
import { hasPermission, type RybexPermission } from "@/lib/d5o/rbac";
import { isProductionRuntime, productionLocalAdapterError } from "@/lib/d5o/security/runtime-mode";

const evidenceBucket = "rybexos-evidence";
const maxFileSizeBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

type WorkflowEvidenceRequirementRow = {
  id: string;
  organization_id: string;
  workspace_id: string;
  workflow_instance_id: string;
  requirement_type: string;
  title: string;
  status: string;
  source_module: string | null;
};

type WorkflowInstanceRow = {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string | null;
  source_module: string;
  entity_name: string;
};

type AttachmentRow = {
  id: string;
};

type EntityAttachmentRow = {
  id: string;
};

type AuditEventRow = {
  id: string;
};

type StatusHistoryRow = {
  id: string;
};

export type UploadEvidenceAttachmentResult = {
  success: boolean;
  mode: "local" | "database";
  message: string;
  attachmentId?: string;
  entityAttachmentId?: string;
  auditEventId?: string;
  statusHistoryId?: string;
  storagePath?: string;
};

export async function uploadEvidenceAttachment(formData: FormData): Promise<UploadEvidenceAttachmentResult> {
  if (!isDatabaseMode() || !isDatabaseEvidenceStore()) {
    return {
      success: false,
      mode: isProductionRuntime() ? "database" : "local",
      message: isProductionRuntime()
        ? productionLocalAdapterError("Evidence uploads")
        : "Database evidence upload pilot is not enabled. Use local demo evidence actions or set RYBEXOS_DATA_SOURCE=database and RYBEXOS_EVIDENCE_STORE=database."
    };
  }

  const evidenceRequirementId = valueFromForm(formData, "evidenceRequirementId");
  const file = formData.get("file");

  if (!evidenceRequirementId) {
    return { success: false, mode: "database", message: "Evidence upload requires an evidence requirement id." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, mode: "database", message: "Choose a file before uploading evidence." };
  }

  const fileValidation = validateFile(file);

  if (fileValidation) {
    return { success: false, mode: "database", message: fileValidation };
  }

  try {
    const currentUser = await getCurrentRybexUser();

    if (!currentUser.authenticated || !currentUser.role) {
      return { success: false, mode: "database", message: currentUser.message };
    }

    const [requirement] = await readSupabaseTable<WorkflowEvidenceRequirementRow>("workflow_evidence_requirements", {
      filters: { id: `eq.${evidenceRequirementId}` },
      limit: 1
    });

    if (!requirement) {
      return {
        success: false,
        mode: "database",
        message: "Evidence requirement was not found in Supabase."
      };
    }

    const [workflow] = await readSupabaseTable<WorkflowInstanceRow>("workflow_instances", {
      filters: { id: `eq.${requirement.workflow_instance_id}` },
      limit: 1
    });

    if (!workflow) {
      return {
        success: false,
        mode: "database",
        message: "Evidence workflow instance was not found in Supabase."
      };
    }

    const permission = getEvidenceUploadPermission(requirement.source_module ?? workflow.source_module);

    if (!hasPermission(currentUser.role, permission) && !hasPermission(currentUser.role, "manage_admin")) {
      return {
        success: false,
        mode: "database",
        message: `Permission required: ${permission}.`
      };
    }

    const actorUserId = getDatabaseSafeActorUserId(currentUser);
    const timestamp = new Date().toISOString();
    const storagePath = buildStoragePath({
      organizationId: requirement.organization_id,
      workspaceId: requirement.workspace_id,
      projectId: workflow.project_id,
      evidenceRequirementId: requirement.id,
      fileName: file.name
    });

    await uploadSupabaseStorageObject({
      bucket: evidenceBucket,
      storagePath,
      file,
      contentType: file.type || "application/octet-stream"
    });

    const attachment = await insertSupabaseRow<AttachmentRow>("attachments", {
      organization_id: requirement.organization_id,
      workspace_id: requirement.workspace_id,
      project_id: workflow.project_id,
      storage_provider: "supabase_storage",
      bucket: evidenceBucket,
      storage_path: storagePath,
      file_name: sanitizeFileName(file.name),
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      status: "active",
      is_private: true,
      virus_scan_status: "not_scanned",
      metadata: {
        pilot: true,
        evidenceRequirementId: requirement.id,
        workflowInstanceId: workflow.id,
        originalFileName: file.name
      },
      created_by: actorUserId,
      updated_by: actorUserId
    });

    const entityAttachment = await insertSupabaseRow<EntityAttachmentRow>("entity_attachments", {
      organization_id: requirement.organization_id,
      workspace_id: requirement.workspace_id,
      project_id: workflow.project_id,
      entity_type: "workflow_evidence_requirement",
      entity_id: requirement.id,
      attachment_id: attachment.id,
      relationship_type: "evidence",
      metadata: {
        pilot: true,
        sourceModule: requirement.source_module ?? workflow.source_module
      },
      created_by: actorUserId,
      updated_by: actorUserId
    });

    await updateSupabaseRows<WorkflowEvidenceRequirementRow>(
      "workflow_evidence_requirements",
      { id: `eq.${requirement.id}` },
      {
        status: "uploaded",
        attachment_id: attachment.id,
        updated_at: timestamp
      }
    );

    const auditEvent = await insertSupabaseRow<AuditEventRow>("audit_events", {
      organization_id: requirement.organization_id,
      workspace_id: requirement.workspace_id,
      project_id: workflow.project_id,
      entity_type: "workflow_evidence_requirement",
      entity_id: requirement.id,
      action: "evidence_uploaded",
      actor_role: currentUser.role,
      actor_name: currentUser.name,
      actor_user_id: actorUserId,
      summary: `Evidence uploaded for ${requirement.title}.`,
      before_state: {
        status: requirement.status,
        attachmentId: null
      },
      after_state: {
        status: "uploaded",
        attachmentId: attachment.id
      },
      severity: "info",
      metadata: {
        attachmentId: attachment.id,
        entityAttachmentId: entityAttachment.id,
        storageBucket: evidenceBucket,
        storagePath,
        productionUploadPilot: true
      },
      created_at: timestamp
    });

    const statusHistory = requirement.status !== "uploaded"
      ? await insertSupabaseRow<StatusHistoryRow>("status_history", {
          organization_id: requirement.organization_id,
          workspace_id: requirement.workspace_id,
          project_id: workflow.project_id,
          entity_type: "workflow_evidence_requirement",
          entity_id: requirement.id,
          from_status: requirement.status,
          to_status: "uploaded",
          changed_by: actorUserId,
          changed_at: timestamp,
          reason: "Evidence upload pilot attached file metadata and private storage object.",
          related_audit_event_id: auditEvent.id,
          metadata: {
            attachmentId: attachment.id,
            storageBucket: evidenceBucket,
            storagePath
          }
        })
      : undefined;

    return {
      success: true,
      mode: "database",
      message: "Evidence uploaded to the private Supabase Storage pilot and marked uploaded.",
      attachmentId: attachment.id,
      entityAttachmentId: entityAttachment.id,
      auditEventId: auditEvent.id,
      statusHistoryId: statusHistory?.id,
      storagePath
    };
  } catch (error) {
    return {
      success: false,
      mode: "database",
      message: error instanceof Error ? error.message : "Evidence upload pilot failed."
    };
  }
}

function validateFile(file: File) {
  if (file.size > maxFileSizeBytes) {
    return "Evidence upload pilot accepts files up to 10 MB.";
  }

  if (file.type && !allowedMimeTypes.has(file.type)) {
    return `Unsupported evidence file type: ${file.type}.`;
  }

  return "";
}

function buildStoragePath({
  organizationId,
  workspaceId,
  projectId,
  evidenceRequirementId,
  fileName
}: {
  organizationId: string;
  workspaceId: string;
  projectId: string | null;
  evidenceRequirementId: string;
  fileName: string;
}) {
  const safeName = sanitizeFileName(fileName);

  return [
    organizationId,
    workspaceId,
    projectId ?? "no-project",
    evidenceRequirementId,
    `${Date.now()}-${safeName}`
  ].join("/");
}

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "evidence-file";
}

function valueFromForm(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getEvidenceUploadPermission(sourceModule: string): RybexPermission {
  const normalized = sourceModule.replaceAll("-", "_");

  if (normalized.includes("billing")) {
    return "edit_billing";
  }

  if (normalized.includes("change")) {
    return "edit_changes";
  }

  if (normalized.includes("safety")) {
    return "edit_safety";
  }

  if (normalized.includes("quality")) {
    return "edit_quality";
  }

  if (normalized.includes("closeout")) {
    return "edit_closeout";
  }

  if (normalized.includes("rfi") || normalized.includes("submittal")) {
    return "edit_rfis_submittals";
  }

  if (normalized.includes("field")) {
    return "submit_daily_report";
  }

  if (normalized.includes("mobilization")) {
    return "edit_mobilization";
  }

  return "edit_project_setup";
}
