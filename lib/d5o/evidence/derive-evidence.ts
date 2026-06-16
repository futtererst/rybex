import {
  billingBackupItems,
  closeoutRequirements,
  jhaRecords,
  qualityDeficiencies,
  qualityInspections,
  punchItems,
  safetyObservations,
  safetyPlans,
  testRecords
} from "../seed-data";
import { deriveOperatingWorkflows } from "../workflow/derive-workflows";
import type { OperatingWorkflow } from "../workflow/types";
import type { EvidenceCategory, EvidenceRequirement, EvidenceStatus, DerivedEvidenceSummary } from "./types";

const defaultOrganizationId = "org-rybex-demo";
const defaultWorkspaceId = "workspace-rybex-demo";
const operatingDate = "2026-06-11";

export function deriveEvidenceRequirements(): DerivedEvidenceSummary {
  const workflows = deriveOperatingWorkflows().allOperatingWorkflows;
  const requirements = [
    ...fromWorkflows(workflows),
    ...billingBackupItems.map((item) =>
      evidence({
        id: `evidence-billing-${item.id}`,
        projectId: item.projectId,
        sourceModule: "billing",
        sourceRecordType: "billing_backup_item",
        sourceRecordId: item.id,
        category: "pay_app_backup",
        title: item.title,
        description: item.notes,
        required: item.requiredForBilling,
        status: statusFromGeneric(item.status, item.linkedRecordIds.length > 0),
        owner: item.owner,
        dueDate: item.dueDate,
        requiredForBilling: item.requiredForBilling,
        linkedAttachmentIds: item.linkedRecordIds,
        nextAction: item.requiredForBilling ? "Attach billing backup before pay app submission." : "Keep as supporting backup."
      })
    ),
    ...closeoutRequirements.map((item) =>
      evidence({
        id: `evidence-closeout-${item.id}`,
        projectId: item.projectId,
        workflowInstanceId: item.packageId,
        sourceModule: item.sourceModule,
        sourceRecordType: "closeout_requirement",
        sourceRecordId: item.id,
        category: categoryFromCloseout(item.category),
        title: item.title,
        description: item.description,
        required: true,
        status: statusFromCloseout(item.status, item.attachments.length > 0),
        owner: item.owner,
        dueDate: item.dueDate,
        requiredForBilling: item.finalBillingImpact || item.retainageImpact,
        requiredForCloseout: item.closeoutImpact || item.acceptanceImpact,
        requiredForChangeRecovery: item.category === "change_closure",
        linkedAttachmentIds: item.attachments,
        nextAction: item.nextAction
      })
    ),
    ...testRecords.map((item) =>
      evidence({
        id: `evidence-test-${item.id}`,
        projectId: item.projectId,
        sourceModule: "quality",
        sourceRecordType: "test_record",
        sourceRecordId: item.id,
        category: item.testType === "otdr" ? "otdr_result" : "test_result",
        title: item.title,
        description: item.acceptanceCriteria,
        required: item.requiredForCloseout,
        status: statusFromGeneric(item.status, item.attachments.length > 0),
        owner: item.performedBy,
        dueDate: item.performedDate ?? operatingDate,
        requiredForCloseout: item.requiredForCloseout,
        linkedAttachmentIds: item.attachments,
        nextAction: item.nextAction
      })
    ),
    ...qualityInspections
      .filter((item) => item.requiredPhotos.length > 0 || item.requiredTests.length > 0 || item.passFailResult === "fail")
      .map((item) =>
        evidence({
          id: `evidence-inspection-${item.id}`,
          projectId: item.projectId,
          sourceModule: "quality",
          sourceRecordType: "quality_inspection",
          sourceRecordId: item.id,
          category: item.requiredTests.length > 0 ? "inspection_record" : "photo",
          title: item.title,
          description: item.acceptanceCriteria.join("; "),
          required: true,
          status: item.photosComplete && item.passFailResult !== "fail" ? "verified" : "pending",
          owner: item.inspector,
          dueDate: item.date,
          requiredForGate: true,
          requiredForCloseout: true,
          linkedAttachmentIds: item.requiredPhotos,
          nextAction: item.photosComplete ? "Review inspection evidence." : "Attach required inspection photos or test proof."
        })
      ),
    ...qualityDeficiencies.map((item) =>
      evidence({
        id: `evidence-deficiency-${item.id}`,
        projectId: item.projectId,
        sourceModule: "quality",
        sourceRecordType: "quality_deficiency",
        sourceRecordId: item.id,
        category: "punch_verification",
        title: item.title,
        description: item.description,
        required: item.reinspectionRequired,
        status: statusFromGeneric(item.reinspectionStatus, item.photos.length > 0),
        owner: item.assignedTo,
        dueDate: item.updatedAt,
        requiredForBilling: item.billingImpact,
        requiredForCloseout: item.closeoutImpact,
        linkedAttachmentIds: item.photos,
        nextAction: item.nextAction
      })
    ),
    ...punchItems.map((item) =>
      evidence({
        id: `evidence-punch-${item.id}`,
        projectId: item.projectId,
        sourceModule: "quality",
        sourceRecordType: "punch_item",
        sourceRecordId: item.id,
        category: "punch_verification",
        title: item.title,
        description: item.description,
        required: item.closeoutImpact || item.acceptanceImpact,
        status: statusFromGeneric(item.status, item.photos.length > 0 || Boolean(item.verifiedDate)),
        owner: item.assignedTo,
        dueDate: item.dueDate,
        requiredForCloseout: item.closeoutImpact || item.acceptanceImpact,
        linkedAttachmentIds: item.photos,
        verifiedBy: item.verifiedBy,
        verifiedAt: item.verifiedDate,
        nextAction: item.nextAction
      })
    ),
    ...safetyPlans
      .filter((item) => item.requiredForMobilization)
      .map((item) =>
        evidence({
          id: `evidence-safety-plan-${item.id}`,
          projectId: item.projectId,
          sourceModule: "safety",
          sourceRecordType: "safety_plan",
          sourceRecordId: item.id,
          category: "safety_plan",
          title: item.planName,
          description: item.hazardsCovered.join("; "),
          required: item.requiredForMobilization,
          status: statusFromGeneric(item.status, item.attachments.length > 0),
          owner: item.owner,
          dueDate: item.effectiveDate,
          requiredForGate: true,
          linkedAttachmentIds: item.attachments,
          nextAction: item.nextAction
        })
      ),
    ...jhaRecords
      .filter((item) => item.requiredBeforeWork)
      .map((item) =>
        evidence({
          id: `evidence-jha-${item.id}`,
          projectId: item.projectId,
          workflowInstanceId: item.workPackageId,
          sourceModule: "safety",
          sourceRecordType: "jha_record",
          sourceRecordId: item.id,
          category: "jha",
          title: item.title,
          description: item.hazards.join("; "),
          required: item.requiredBeforeWork,
          status: statusFromGeneric(item.status, item.attachments.length > 0 && item.crewAcknowledged),
          owner: item.owner,
          dueDate: item.date,
          requiredForGate: true,
          linkedAttachmentIds: item.attachments,
          nextAction: item.nextAction
        })
      ),
    ...safetyObservations
      .filter((item) => item.correctiveActionRequired || item.closeoutImpact || item.photos.length === 0)
      .map((item) =>
        evidence({
          id: `evidence-safety-observation-${item.id}`,
          projectId: item.projectId,
          sourceModule: "safety",
          sourceRecordType: "safety_observation",
          sourceRecordId: item.id,
          category: "photo",
          title: item.description,
          description: item.location,
          required: item.correctiveActionRequired || item.closeoutImpact,
          status: statusFromGeneric(item.status, item.photos.length > 0),
          owner: item.assignedTo,
          dueDate: item.dueDate,
          requiredForCloseout: item.closeoutImpact,
          linkedAttachmentIds: item.photos,
          nextAction: item.nextAction
        })
      )
  ];

  return summarize(requirements);
}

function fromWorkflows(workflows: OperatingWorkflow[]) {
  return workflows.flatMap((workflow) =>
    workflow.evidenceNeeded.required.map((title, index) =>
      evidence({
        id: `evidence-workflow-${workflow.id}-${index}`,
        projectId: workflow.projectId,
        workflowInstanceId: workflow.id,
        sourceModule: workflow.sourceModule,
        sourceRecordType: workflow.sourceRecordType,
        sourceRecordId: workflow.sourceRecordId,
        category: categoryFromTitle(title),
        title,
        description: workflow.evidenceNeeded.currentState ?? workflow.description,
        required: true,
        status: workflow.resolutionState === "resolved" ? "verified" : workflow.resolutionState === "ready_for_review" ? "under_review" : "missing",
        owner: workflow.owner,
        dueDate: workflow.dueDate,
        requiredForGate: ["pursuit_control", "contract_baseline", "mobilization_readiness"].includes(workflow.workflowType),
        requiredForBilling: ["billing_cash_control", "change_recovery"].includes(workflow.workflowType),
        requiredForCloseout: workflow.workflowType === "closeout_acceptance",
        requiredForChangeRecovery: workflow.workflowType === "change_recovery",
        linkedAttachmentIds: [],
        nextAction: `Provide ${title.toLowerCase()} to move ${workflow.nextGateOrStatus.label}.`
      })
    )
  );
}

function evidence(input: Partial<EvidenceRequirement> & Pick<EvidenceRequirement, "id" | "sourceModule" | "sourceRecordType" | "sourceRecordId" | "category" | "title" | "description" | "required" | "status" | "owner" | "nextAction">): EvidenceRequirement {
  const verificationStatus = input.status === "verified" ? "verified" : input.status === "waived" ? "waived" : input.status === "rejected" ? "rejected" : input.status === "under_review" || input.status === "uploaded" ? "ready_for_review" : "not_started";

  return {
    organizationId: defaultOrganizationId,
    workspaceId: defaultWorkspaceId,
    requiredForGate: false,
    requiredForBilling: false,
    requiredForCloseout: false,
    requiredForChangeRecovery: false,
    linkedAttachmentIds: [],
    verificationStatus,
    ...input
  };
}

function summarize(requirements: EvidenceRequirement[]): DerivedEvidenceSummary {
  return {
    allEvidenceRequirements: requirements,
    missingEvidence: requirements.filter((item) => ["missing", "pending", "rejected"].includes(item.status) && item.required),
    evidenceByProject: groupBy(requirements, (item) => item.projectId ?? "unassigned"),
    evidenceByWorkflow: groupBy(requirements.filter((item) => item.workflowInstanceId), (item) => item.workflowInstanceId ?? "unassigned"),
    evidenceByCategory: groupBy(requirements, (item) => item.category),
    evidenceBlockingGate: requirements.filter((item) => item.requiredForGate && ["missing", "pending", "rejected"].includes(item.status)),
    evidenceBlockingBilling: requirements.filter((item) => item.requiredForBilling && ["missing", "pending", "rejected"].includes(item.status)),
    evidenceBlockingCloseout: requirements.filter((item) => item.requiredForCloseout && ["missing", "pending", "rejected"].includes(item.status)),
    evidenceReadyForReview: requirements.filter((item) => ["uploaded", "under_review"].includes(item.status))
  };
}

function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce((groups, item) => {
    const groupKey = key(item);
    return {
      ...groups,
      [groupKey]: [...(groups[groupKey] ?? []), item]
    };
  }, {} as Record<K, T[]>);
}

function statusFromGeneric(status: string, hasAttachment: boolean): EvidenceStatus {
  if (["closed", "verified", "complete", "accepted", "passed", "approved"].includes(status) && hasAttachment) return "verified";
  if (["waived"].includes(status)) return "waived";
  if (["rejected", "failed"].includes(status)) return "rejected";
  if (hasAttachment) return "uploaded";
  if (["in_progress", "pending", "submitted"].includes(status)) return "pending";
  return "missing";
}

function statusFromCloseout(status: string, hasAttachment: boolean): EvidenceStatus {
  if (status === "accepted" || status === "archived") return "verified";
  if (status === "waived") return "waived";
  if (status === "rejected") return "rejected";
  if (hasAttachment) return "uploaded";
  if (status === "submitted" || status === "in_progress") return "pending";
  return "missing";
}

function categoryFromCloseout(category: string): EvidenceCategory {
  if (category === "as_built" || category === "redline") return "as_built";
  if (category === "test_record") return "test_result";
  if (category === "photo_evidence") return "photo";
  if (category === "warranty") return "warranty";
  if (category === "om_document") return "om_document";
  if (category === "lien_waiver") return "lien_waiver";
  if (category === "final_billing") return "pay_app_backup";
  if (category === "punch_item") return "punch_verification";
  if (category === "change_closure") return "change_backup";
  if (category === "rfi_closure") return "rfi_attachment";
  if (category === "submittal_closeout") return "submittal_package";
  if (category === "certification") return "test_result";
  if (category === "acceptance" || category === "archive") return "closeout_package";
  return "other";
}

function categoryFromTitle(title: string): EvidenceCategory {
  const normalized = title.toLowerCase();
  if (normalized.includes("otdr")) return "otdr_result";
  if (normalized.includes("photo")) return "photo";
  if (normalized.includes("daily report")) return "daily_report";
  if (normalized.includes("jha") || normalized.includes("jsa")) return "jha";
  if (normalized.includes("safety")) return "safety_plan";
  if (normalized.includes("locate")) return "utility_locate";
  if (normalized.includes("rfi")) return "rfi_attachment";
  if (normalized.includes("submittal")) return "submittal_package";
  if (normalized.includes("change") || normalized.includes("backup")) return "change_backup";
  if (normalized.includes("pay") || normalized.includes("billing")) return "pay_app_backup";
  if (normalized.includes("waiver")) return "lien_waiver";
  if (normalized.includes("inspection")) return "inspection_record";
  if (normalized.includes("test") || normalized.includes("certification")) return "test_result";
  if (normalized.includes("punch") || normalized.includes("deficiency")) return "punch_verification";
  if (normalized.includes("as-built") || normalized.includes("redline")) return "as_built";
  if (normalized.includes("warranty")) return "warranty";
  if (normalized.includes("o&m") || normalized.includes("manual")) return "om_document";
  if (normalized.includes("approval")) return "approval_record";
  return "other";
}
