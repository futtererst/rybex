import {
  createBillingEvent,
  createBillingReviewPackageSummary,
  getBillingTimestamp,
  getBillingV2StateDisplayLabel
} from "./billing-v2-events";
import { appendBillingHistoryEntries } from "./billing-v2-history";
import {
  generateBillingBlockerResolution,
  generateBillingOutcomeRecord,
  formatBillingCurrency
} from "./billing-v2-outcomes";
import {
  billingReadinessMessages,
  evaluateBillingPackageReadiness
} from "./billing-v2-readiness";
import { generateBillingHistoricalRecord } from "./billing-v2-history";
import type {
  BillingBackupPackage,
  BillingCommandResult,
  BillingPackageReadiness,
  BillingReviewDecision,
  BillingReviewTask,
  BillingV2Event,
  BillingV2EventType,
  BillingV2State,
  ClearBillingBlockerCommand,
  ReopenBillingBlockerCommand,
  ReviewDecisionCommand,
  SaveAmountAffectedCommand,
  SaveBackupSummaryCommand,
  SaveEvidenceReferenceCommand,
  SaveRelatedSourceRecordCommand,
  SaveResolutionNoteCommand,
  SaveReviewNoteCommand,
  SendPackageToCommercialReviewCommand,
  StartBackupPackageCommand,
  ValidatePackageReadinessCommand,
  WaiveEvidenceRequirementCommand
} from "./types";

const editablePackageStates: BillingV2State[] = [
  "backup_package_in_progress",
  "evidence_required",
  "reopened",
  "commercial_review_changes_requested"
];

function clonePackage(billingPackage: BillingBackupPackage): BillingBackupPackage {
  return JSON.parse(JSON.stringify(billingPackage)) as BillingBackupPackage;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function successResult(
  billingPackage: BillingBackupPackage,
  events: BillingV2Event[],
  message: string,
  readiness?: BillingPackageReadiness
): BillingCommandResult {
  return {
    success: true,
    package: billingPackage,
    events,
    message,
    readiness
  };
}

function failureResult(
  originalPackage: BillingBackupPackage,
  message: string,
  readiness?: BillingPackageReadiness
): BillingCommandResult {
  return {
    success: false,
    package: originalPackage,
    events: [],
    message,
    error: message,
    readiness
  };
}

function requireState(
  billingPackage: BillingBackupPackage,
  allowedStates: BillingV2State[],
  message: string
): BillingCommandResult | null {
  if (!allowedStates.includes(billingPackage.state)) {
    return failureResult(billingPackage, message);
  }

  return null;
}

function hasApprovedReview(billingPackage: BillingBackupPackage): boolean {
  return billingPackage.reviewTask?.status === "approved" && billingPackage.reviewDecision?.decision === "approved";
}

function completeCommand(
  billingPackage: BillingBackupPackage,
  events: BillingV2Event[],
  history: Array<{ event: BillingV2Event; label: string; note: string }>,
  occurredAt: string,
  message: string,
  readiness?: BillingPackageReadiness
): BillingCommandResult {
  return successResult(
    appendBillingHistoryEntries(billingPackage, events, history, occurredAt),
    events,
    message,
    readiness
  );
}

function createCommandEvent(
  billingPackage: BillingBackupPackage,
  type: BillingV2EventType,
  actorId: string,
  occurredAt: string,
  fromState?: BillingV2State,
  toState?: BillingV2State,
  payload?: BillingV2Event["payload"],
  message?: string
) {
  return createBillingEvent(billingPackage, type, actorId, occurredAt, fromState, toState, payload, message);
}

export { evaluateBillingPackageReadiness as evaluatePackageReadiness, getBillingV2StateDisplayLabel };

export function startBackupPackage(
  originalPackage: BillingBackupPackage,
  command: StartBackupPackageCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, ["blocked", "reopened"], "This package is already active.");
  if (stateFailure) return stateFailure;

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  const fromState = billingPackage.state;
  billingPackage.state = "backup_package_in_progress";

  const event = createCommandEvent(
    billingPackage,
    "BillingBackupPackageStarted",
    command.actorId,
    occurredAt,
    fromState,
    billingPackage.state
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Backup package started", note: "Billing backup package work started." }],
    occurredAt,
    "Billing backup package started."
  );
}

export function saveBackupSummary(
  originalPackage: BillingBackupPackage,
  command: SaveBackupSummaryCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, editablePackageStates, "Backup summary can only be saved while the package is editable.");
  if (stateFailure) return stateFailure;

  const summary = clean(command.summary);
  if (!summary) return failureResult(originalPackage, "Enter a backup summary before saving.");

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  billingPackage.backupSummary = summary;

  const event = createCommandEvent(
    billingPackage,
    "BillingBackupSummarySaved",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { summary }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Backup summary saved", note: summary }],
    occurredAt,
    "Backup summary saved."
  );
}

export function saveRelatedSourceRecord(
  originalPackage: BillingBackupPackage,
  command: SaveRelatedSourceRecordCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, editablePackageStates, "Source record can only be saved while the package is editable.");
  if (stateFailure) return stateFailure;

  const label = clean(command.sourceRecordLabel);
  const type = clean(command.sourceRecordType);
  if (!label || !type) return failureResult(originalPackage, "Link a source record before saving.");

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  billingPackage.relatedSourceRecord = {
    id: command.sourceRecordId,
    label,
    type
  };

  const event = createCommandEvent(
    billingPackage,
    "BillingSourceRecordSaved",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { sourceRecordLabel: label, sourceRecordType: type }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Source record linked", note: label }],
    occurredAt,
    "Source record linked."
  );
}

export function saveAmountAffected(
  originalPackage: BillingBackupPackage,
  command: SaveAmountAffectedCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, editablePackageStates, "Amount affected can only be saved while the package is editable.");
  if (stateFailure) return stateFailure;

  if (!Number.isFinite(command.amountAffected) || command.amountAffected <= 0) {
    return failureResult(originalPackage, "Enter the amount affected before saving.");
  }

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  billingPackage.amountAffected = command.amountAffected;
  billingPackage.currency = command.currency ?? billingPackage.currency;

  const event = createCommandEvent(
    billingPackage,
    "BillingAmountAffectedSaved",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { amountAffected: command.amountAffected, currency: billingPackage.currency }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Amount affected saved", note: formatBillingCurrency(command.amountAffected, billingPackage.currency) }],
    occurredAt,
    "Amount affected saved."
  );
}

export function saveReviewNote(
  originalPackage: BillingBackupPackage,
  command: SaveReviewNoteCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, editablePackageStates, "Review note can only be saved while the package is editable.");
  if (stateFailure) return stateFailure;

  const reviewNote = clean(command.reviewNote);
  if (!reviewNote) return failureResult(originalPackage, "Enter a review note before saving.");

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  billingPackage.reviewNote = reviewNote;

  const event = createCommandEvent(
    billingPackage,
    "BillingReviewNoteSaved",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { reviewNote }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Review note saved", note: reviewNote }],
    occurredAt,
    "Review note saved."
  );
}

export function saveEvidenceReference(
  originalPackage: BillingBackupPackage,
  command: SaveEvidenceReferenceCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, editablePackageStates, "Evidence references can only be saved while the package is editable.");
  if (stateFailure) return stateFailure;

  const referenceText = clean(command.referenceText);
  if (!referenceText) return failureResult(originalPackage, "Enter an evidence reference before saving this item.");

  const requirementIndex = originalPackage.evidenceRequirements.findIndex((item) => item.id === command.evidenceRequirementId);
  if (requirementIndex === -1) return failureResult(originalPackage, "Evidence requirement was not found.");

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  const requirement = billingPackage.evidenceRequirements[requirementIndex];
  requirement.status = "referenced";
  requirement.reference = {
    id: `${billingPackage.id}-${requirement.id}-reference`,
    requirementId: requirement.id,
    referenceText,
    referenceType: command.referenceType,
    linkedRecordId: command.linkedRecordId,
    storagePointer: command.storagePointer,
    savedBy: command.actorId,
    savedAt: occurredAt
  };
  requirement.waiverReason = undefined;
  requirement.updatedAt = occurredAt;

  const event = createCommandEvent(
    billingPackage,
    "BillingEvidenceReferenceSaved",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { evidenceRequirementId: requirement.id, referenceType: command.referenceType }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: `${requirement.label} reference saved`, note: referenceText }],
    occurredAt,
    "Evidence reference saved."
  );
}

export function waiveEvidenceRequirement(
  originalPackage: BillingBackupPackage,
  command: WaiveEvidenceRequirementCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, editablePackageStates, "Evidence requirements can only be waived while the package is editable.");
  if (stateFailure) return stateFailure;

  const waiverReason = clean(command.waiverReason);
  if (!waiverReason) {
    return failureResult(originalPackage, "Waiver reason is required before this evidence requirement can be waived.");
  }

  const requirementIndex = originalPackage.evidenceRequirements.findIndex((item) => item.id === command.evidenceRequirementId);
  if (requirementIndex === -1) return failureResult(originalPackage, "Evidence requirement was not found.");

  if (!originalPackage.evidenceRequirements[requirementIndex].waiverAllowed) {
    return failureResult(originalPackage, "This evidence requirement cannot be waived.");
  }

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  const requirement = billingPackage.evidenceRequirements[requirementIndex];
  requirement.status = "waived";
  requirement.waiverReason = waiverReason;
  requirement.reference = undefined;
  requirement.updatedAt = occurredAt;

  const event = createCommandEvent(
    billingPackage,
    "BillingEvidenceRequirementWaived",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { evidenceRequirementId: requirement.id }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: `${requirement.label} waived`, note: waiverReason }],
    occurredAt,
    "Evidence requirement waived with reason."
  );
}

export function validatePackageReadiness(
  originalPackage: BillingBackupPackage,
  command: ValidatePackageReadinessCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, editablePackageStates, "Package readiness can only be validated while the package is editable.");
  if (stateFailure) return stateFailure;

  const readiness = evaluateBillingPackageReadiness(originalPackage);
  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  const fromState = billingPackage.state;
  billingPackage.state = readiness.isReady ? "package_ready_for_review" : "evidence_required";

  const event = createCommandEvent(
    billingPackage,
    "BillingPackageReadinessValidated",
    command.actorId,
    occurredAt,
    fromState,
    billingPackage.state,
    { isReady: readiness.isReady, missingItemCount: readiness.missingItems.length },
    readiness.isReady ? billingReadinessMessages.readinessPassed : "Package readiness is missing required items."
  );

  const message = readiness.isReady
    ? billingReadinessMessages.readinessPassed
    : billingReadinessMessages.readinessIncomplete;

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Package readiness validated", note: readiness.isReady ? "Ready for review." : readiness.missingItems.join(", ") }],
    occurredAt,
    message,
    readiness
  );
}

export function sendPackageToCommercialReview(
  originalPackage: BillingBackupPackage,
  command: SendPackageToCommercialReviewCommand
): BillingCommandResult {
  const readiness = evaluateBillingPackageReadiness(originalPackage);

  if (originalPackage.state !== "package_ready_for_review" || !readiness.isReady) {
    return failureResult(originalPackage, billingReadinessMessages.sendToReviewBlocked, readiness);
  }

  if (originalPackage.reviewTask?.status === "pending") {
    return failureResult(originalPackage, "Commercial review is already pending.");
  }

  const assignedRole = clean(command.assignedRole);
  if (!assignedRole) return failureResult(originalPackage, "Assign a commercial reviewer role before sending to review.");

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  const fromState = billingPackage.state;
  billingPackage.state = "commercial_review_pending";

  const reviewTask: BillingReviewTask = {
    id: `${billingPackage.id}-review-001`,
    packageId: billingPackage.id,
    assignedRole,
    status: "pending",
    createdBy: command.actorId,
    createdAt: occurredAt,
    dueDate: command.dueDate,
    packageSummary: createBillingReviewPackageSummary(billingPackage)
  };
  billingPackage.reviewTask = reviewTask;

  const event = createCommandEvent(
    billingPackage,
    "BillingCommercialReviewTaskCreated",
    command.actorId,
    occurredAt,
    fromState,
    billingPackage.state,
    { reviewTaskId: reviewTask.id, assignedRole }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Commercial review task created", note: `Assigned to ${assignedRole}.` }],
    occurredAt,
    "Commercial review task created."
  );
}

function decideCommercialReview(
  originalPackage: BillingBackupPackage,
  command: ReviewDecisionCommand,
  decision: BillingReviewDecision["decision"],
  eventType: BillingV2EventType,
  nextState: BillingV2State,
  successMessage: string,
  missingNoteMessage: string
): BillingCommandResult {
  if (originalPackage.state !== "commercial_review_pending" || originalPackage.reviewTask?.status !== "pending") {
    return failureResult(originalPackage, "Commercial review decision requires a pending review task.");
  }

  if (originalPackage.reviewTask.id !== command.reviewTaskId) {
    return failureResult(originalPackage, "Review task does not match this billing package.");
  }

  const decisionNote = clean(command.decisionNote);
  if (!decisionNote) return failureResult(originalPackage, missingNoteMessage);

  const billingPackage = clonePackage(originalPackage);
  const reviewTask = billingPackage.reviewTask;
  if (!reviewTask) {
    return failureResult(originalPackage, "Commercial review decision requires a pending review task.");
  }

  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  const fromState = billingPackage.state;
  billingPackage.state = nextState;

  const reviewDecision: BillingReviewDecision = {
    id: `${billingPackage.id}-decision-${decision}`,
    reviewTaskId: command.reviewTaskId,
    decision,
    decisionNote,
    reviewerId: command.reviewerId,
    decidedAt: occurredAt
  };
  billingPackage.reviewDecision = reviewDecision;
  billingPackage.reviewTask = {
    ...reviewTask,
    status: decision,
    decisionId: reviewDecision.id
  };

  const event = createCommandEvent(
    billingPackage,
    eventType,
    command.reviewerId,
    occurredAt,
    fromState,
    billingPackage.state,
    { reviewTaskId: command.reviewTaskId, decision },
    successMessage
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: successMessage, note: decisionNote }],
    occurredAt,
    successMessage
  );
}

export function approveCommercialReview(
  originalPackage: BillingBackupPackage,
  command: ReviewDecisionCommand
): BillingCommandResult {
  return decideCommercialReview(
    originalPackage,
    command,
    "approved",
    "BillingCommercialReviewApproved",
    "commercial_review_approved",
    "Commercial review approved.",
    "Enter a commercial review decision note before approving."
  );
}

export function requestCommercialReviewChanges(
  originalPackage: BillingBackupPackage,
  command: ReviewDecisionCommand
): BillingCommandResult {
  return decideCommercialReview(
    originalPackage,
    command,
    "changes_requested",
    "BillingCommercialReviewChangesRequested",
    "commercial_review_changes_requested",
    "Changes requested. Update the package before resubmitting.",
    "Enter a change request note before returning the package."
  );
}

export function rejectCommercialReview(
  originalPackage: BillingBackupPackage,
  command: ReviewDecisionCommand
): BillingCommandResult {
  return decideCommercialReview(
    originalPackage,
    command,
    "rejected",
    "BillingCommercialReviewRejected",
    "commercial_review_rejected",
    "Commercial review rejected.",
    "Enter a rejection note before rejecting the package."
  );
}

export function saveResolutionNote(
  originalPackage: BillingBackupPackage,
  command: SaveResolutionNoteCommand
): BillingCommandResult {
  const stateFailure = requireState(originalPackage, ["commercial_review_approved"], "Resolution note can only be saved after commercial review approval.");
  if (stateFailure) return stateFailure;

  const resolutionNote = clean(command.resolutionNote);
  if (!resolutionNote) return failureResult(originalPackage, "Enter a resolution note before saving.");

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  billingPackage.resolutionNote = resolutionNote;

  const event = createCommandEvent(
    billingPackage,
    "BillingResolutionNoteSaved",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { resolutionNote }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Resolution note saved", note: resolutionNote }],
    occurredAt,
    "Resolution note saved."
  );
}

export function clearBillingBlocker(
  originalPackage: BillingBackupPackage,
  command: ClearBillingBlockerCommand
): BillingCommandResult {
  const readiness = evaluateBillingPackageReadiness(originalPackage);

  if (originalPackage.state === "commercial_review_rejected") {
    return failureResult(originalPackage, "Rejected billing packages cannot clear the blocker. Reopen the package to continue.", readiness);
  }

  if (!hasApprovedReview(originalPackage)) {
    return failureResult(originalPackage, "Commercial review must be approved before the billing blocker can be cleared.", readiness);
  }

  if (!clean(originalPackage.resolutionNote)) {
    return failureResult(originalPackage, "Enter a resolution note before clearing this blocker.", readiness);
  }

  if (!readiness.isReady) {
    return failureResult(originalPackage, billingReadinessMessages.clearanceReadinessBlocked, readiness);
  }

  if (!originalPackage.reviewDecision || !originalPackage.reviewTask) {
    return failureResult(originalPackage, "Commercial review record is required before the billing blocker can be cleared.", readiness);
  }

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  const fromState = billingPackage.state;
  const resolution = generateBillingBlockerResolution(billingPackage, command.actorId, occurredAt);
  billingPackage.state = "billing_blocker_cleared";
  billingPackage.blockerResolution = resolution;

  const outcome = generateBillingOutcomeRecord(billingPackage, command.actorId, occurredAt);
  const historicalRecord = generateBillingHistoricalRecord(billingPackage, command.actorId, occurredAt, outcome);
  billingPackage.outcomeRecord = outcome;
  billingPackage.historicalRecord = historicalRecord;

  const blockerClearedEvent = createCommandEvent(
    billingPackage,
    "BillingBlockerCleared",
    command.actorId,
    occurredAt,
    fromState,
    billingPackage.state,
    { resolutionId: resolution.id }
  );
  const outcomeEvent = createCommandEvent(
    { ...billingPackage, events: [...billingPackage.events, blockerClearedEvent] },
    "BillingOutcomeRecordGenerated",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { outcomeRecordId: outcome.id }
  );
  const historyEvent = createCommandEvent(
    { ...billingPackage, events: [...billingPackage.events, blockerClearedEvent, outcomeEvent] },
    "BillingHistoricalRecordGenerated",
    command.actorId,
    occurredAt,
    billingPackage.state,
    billingPackage.state,
    { historicalRecordId: historicalRecord.id }
  );

  const events = [blockerClearedEvent, outcomeEvent, historyEvent];

  return completeCommand(
    billingPackage,
    events,
    [
      { event: blockerClearedEvent, label: "Billing blocker cleared", note: billingPackage.resolutionNote ?? "" },
      { event: outcomeEvent, label: "Outcome record generated", note: outcome.outcome },
      { event: historyEvent, label: "Historical record generated", note: historicalRecord.recordLabel }
    ],
    occurredAt,
    outcome.outcome,
    readiness
  );
}

export function reopenBillingBlocker(
  originalPackage: BillingBackupPackage,
  command: ReopenBillingBlockerCommand
): BillingCommandResult {
  const stateFailure = requireState(
    originalPackage,
    ["billing_blocker_cleared", "commercial_review_rejected", "commercial_review_changes_requested"],
    "This billing package cannot be reopened from its current state."
  );
  if (stateFailure) return stateFailure;

  const reopenReason = clean(command.reopenReason);
  if (!reopenReason) return failureResult(originalPackage, "Enter a reopen reason before reopening this package.");

  const billingPackage = clonePackage(originalPackage);
  const occurredAt = getBillingTimestamp(command.occurredAt, billingPackage);
  const fromState = billingPackage.state;
  billingPackage.state = "reopened";

  const event = createCommandEvent(
    billingPackage,
    "BillingBlockerReopened",
    command.actorId,
    occurredAt,
    fromState,
    billingPackage.state,
    { reopenReason }
  );

  return completeCommand(
    billingPackage,
    [event],
    [{ event, label: "Billing backup package reopened", note: reopenReason }],
    occurredAt,
    "Billing backup package reopened."
  );
}

export const billingV2Commands = {
  startBackupPackage,
  saveBackupSummary,
  saveRelatedSourceRecord,
  saveAmountAffected,
  saveReviewNote,
  saveEvidenceReference,
  waiveEvidenceRequirement,
  validatePackageReadiness,
  sendPackageToCommercialReview,
  approveCommercialReview,
  requestCommercialReviewChanges,
  rejectCommercialReview,
  saveResolutionNote,
  clearBillingBlocker,
  reopenBillingBlocker
};
