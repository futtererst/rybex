import type {
  AcceptanceRecord,
  ChangeEvent,
  CloseoutDecision,
  CloseoutPackage,
  CloseoutRequirement,
  CorrectiveAction,
  DailyReport,
  LienWaiver,
  PayApplication,
  PunchItem,
  QualityDeficiency,
  RFI,
  RybexProject,
  Submittal,
  TestRecord
} from "./types";

const closedRequirementStatuses = ["accepted", "waived", "archived"];
const closedSafetyQualityStatuses = ["closed", "verified", "passed"];

export type D5GateReadiness = {
  closeoutReadinessScore: number;
  readyForSubmissionBoolean: boolean;
  readyForFinalBillingBoolean: boolean;
  readyForRetainageReleaseBoolean: boolean;
  readyForArchiveBoolean: boolean;
  missingRequiredDocuments: CloseoutRequirement[];
  unresolvedPunchItems: PunchItem[];
  missingTestRecords: TestRecord[];
  missingAsBuilts: CloseoutRequirement[];
  unresolvedRfisOrSubmittals: Array<RFI | Submittal>;
  unresolvedChangeEvents: ChangeEvent[];
  unbilledApprovedChanges: ChangeEvent[];
  finalBillingBlockers: string[];
  retainageReleaseBlockers: string[];
  acceptanceBlockers: string[];
  archiveBlockers: string[];
  warnings: string[];
  requiredActions: string[];
  nextActions: string[];
  recommendedDecision: CloseoutDecision;
};

export function evaluateD5Gate({
  closeoutPackage,
  project,
  requirements,
  acceptanceRecords,
  dailyReports,
  punchItems,
  testRecords,
  qualityDeficiencies,
  correctiveActions,
  rfis,
  submittals,
  changeEvents,
  payApplications,
  lienWaivers
}: {
  closeoutPackage: CloseoutPackage;
  project?: RybexProject;
  requirements: CloseoutRequirement[];
  acceptanceRecords: AcceptanceRecord[];
  dailyReports: DailyReport[];
  punchItems: PunchItem[];
  testRecords: TestRecord[];
  qualityDeficiencies: QualityDeficiency[];
  correctiveActions: CorrectiveAction[];
  rfis: RFI[];
  submittals: Submittal[];
  changeEvents: ChangeEvent[];
  payApplications: PayApplication[];
  lienWaivers: LienWaiver[];
}): D5GateReadiness {
  const packageRequirements = requirements.filter((item) => item.packageId === closeoutPackage.id);
  const projectId = closeoutPackage.projectId;
  const projectRfis = rfis.filter((item) => item.projectId === projectId && !["closed", "void", "answered"].includes(item.status));
  const projectSubmittals = submittals.filter((item) =>
    item.projectId === projectId && !["approved", "approved_as_noted", "closed"].includes(item.status)
  );
  const projectChanges = changeEvents.filter((item) => projectId === item.projectId && !["billed", "closed"].includes(item.status));
  const unbilledApprovedChanges = changeEvents.filter((item) =>
    item.projectId === projectId && item.approvedAmount > 0 && item.billingStatus === "approved_not_billed"
  );
  const projectPayApps = payApplications.filter((item) => item.projectId === projectId);
  const finalPayApps = projectPayApps.filter((item) =>
    ["approved", "paid", "partially_paid", "aging", "disputed"].includes(item.status)
  );
  const projectLienWaivers = lienWaivers.filter((item) => item.projectId === projectId);
  const missingRequiredDocuments = packageRequirements.filter((item) =>
    item.closeoutImpact && !closedRequirementStatuses.includes(item.status)
  );
  const missingAsBuilts = packageRequirements.filter((item) =>
    ["as_built", "redline"].includes(item.category) && !closedRequirementStatuses.includes(item.status)
  );
  const missingTestRecords = testRecords.filter((item) =>
    item.projectId === projectId &&
    item.requiredForCloseout &&
    (item.attachments.length === 0 || ["not_started", "draft", "failed", "overdue", "blocked"].includes(item.status))
  );
  const unresolvedPunchItems = punchItems.filter((item) =>
    item.projectId === projectId && item.closeoutImpact && !closedSafetyQualityStatuses.includes(item.status)
  );
  const unresolvedQuality = qualityDeficiencies.filter((item) =>
    item.projectId === projectId && item.closeoutImpact && !closedSafetyQualityStatuses.includes(item.status)
  );
  const unresolvedSafetyQualityActions = correctiveActions.filter((item) =>
    item.projectId === projectId && item.closeoutImpact && !closedSafetyQualityStatuses.includes(item.status)
  );
  const photoGaps = dailyReports.filter((item) => item.projectId === projectId && !item.requiredPhotosComplete);
  const fieldTestGaps = dailyReports.filter((item) => item.projectId === projectId && !item.requiredTestsComplete);
  const acceptance = acceptanceRecords.find((item) => item.packageId === closeoutPackage.id);

  const finalBillingBlockers = [
    ...unbilledApprovedChanges.map((item) => `${item.changeNumber}: ${item.title} approved but not billed.`),
    ...projectPayApps.filter((item) => ["draft", "rejected", "disputed", "aging"].includes(item.status)).map((item) => `${item.payApplicationNumber}: ${item.nextAction}`),
    ...packageRequirements.filter((item) => item.finalBillingImpact && !closedRequirementStatuses.includes(item.status)).map((item) => item.title)
  ];
  const retainageReleaseBlockers = [
    ...projectLienWaivers.filter((item) => ["missing", "pending", "rejected", "required"].includes(item.status)).map((item) => item.notes),
    ...packageRequirements.filter((item) => item.retainageImpact && !closedRequirementStatuses.includes(item.status)).map((item) => item.title)
  ];
  const acceptanceBlockers = [
    ...missingAsBuilts.map((item) => item.title),
    ...missingTestRecords.map((item) => item.title),
    ...unresolvedPunchItems.map((item) => item.title),
    ...unresolvedQuality.map((item) => item.title),
    ...packageRequirements.filter((item) => item.acceptanceImpact && !closedRequirementStatuses.includes(item.status)).map((item) => item.title)
  ];
  const archiveBlockers = [
    ...packageRequirements.filter((item) => item.category === "archive" && !closedRequirementStatuses.includes(item.status)).map((item) => item.title),
    ...(acceptance && !["accepted", "accepted_with_exceptions", "closed"].includes(acceptance.status) ? ["Acceptance is not closed."] : []),
    ...(closeoutPackage.retainageReleaseStatus !== "released" ? ["Retainage release is not complete."] : [])
  ];
  const unresolvedRfisOrSubmittals = [...projectRfis, ...projectSubmittals];
  const requiredActions = [
    ...acceptanceBlockers,
    ...finalBillingBlockers,
    ...retainageReleaseBlockers,
    ...unresolvedRfisOrSubmittals.map((item) => item.nextAction),
    ...projectChanges.map((item) => item.requiredAction)
  ].filter(Boolean);

  const resolvedRequirementCount = packageRequirements.filter((item) =>
    closedRequirementStatuses.includes(item.status)
  ).length;
  const baseScore = packageRequirements.length > 0
    ? Math.round((resolvedRequirementCount / packageRequirements.length) * 100)
    : closeoutPackage.readinessScore;
  const penalty =
    missingTestRecords.length * 5 +
    unresolvedPunchItems.length * 5 +
    missingAsBuilts.length * 6 +
    unresolvedRfisOrSubmittals.length * 3 +
    projectChanges.length * 4 +
    unbilledApprovedChanges.length * 6 +
    finalBillingBlockers.length * 3 +
    retainageReleaseBlockers.length * 3 +
    unresolvedSafetyQualityActions.length * 3 +
    photoGaps.length * 2 +
    fieldTestGaps.length * 2;
  const closeoutReadinessScore = Math.max(0, Math.min(100, Math.round((baseScore + closeoutPackage.readinessScore) / 2 - penalty)));

  const readyForSubmissionBoolean =
    closeoutReadinessScore >= 80 &&
    acceptanceBlockers.length === 0 &&
    unresolvedRfisOrSubmittals.length === 0 &&
    projectChanges.length <= unbilledApprovedChanges.length;
  const readyForFinalBillingBoolean = finalBillingBlockers.length === 0 && finalPayApps.length > 0;
  const readyForRetainageReleaseBoolean =
    readyForFinalBillingBoolean &&
    retainageReleaseBlockers.length === 0 &&
    ["accepted", "accepted_with_exceptions", "closed"].includes(acceptance?.status ?? closeoutPackage.acceptanceStatus);
  const readyForArchiveBoolean =
    readyForRetainageReleaseBoolean &&
    archiveBlockers.length === 0 &&
    ["accepted", "closed", "archived"].includes(closeoutPackage.status);

  let recommendedDecision: CloseoutDecision = "continue_assembling";
  if (readyForArchiveBoolean) recommendedDecision = "accepted_ready_to_archive";
  else if (readyForSubmissionBoolean) recommendedDecision = "submit_for_acceptance";
  else if (missingAsBuilts.length > 0) recommendedDecision = "hold_for_as_builts";
  else if (missingTestRecords.length > 0) recommendedDecision = "hold_for_test_records";
  else if (unresolvedPunchItems.length > 0 || unresolvedQuality.length > 0) recommendedDecision = "hold_for_punch_resolution";
  else if (projectChanges.length > 0 || unbilledApprovedChanges.length > 0) recommendedDecision = "hold_for_change_closure";
  else if (finalBillingBlockers.length > 0) recommendedDecision = "hold_for_final_billing";
  else if (retainageReleaseBlockers.length > 0) recommendedDecision = "hold_for_retainage_requirements";
  else if (missingRequiredDocuments.length > 0) recommendedDecision = "hold_for_missing_documents";

  return {
    closeoutReadinessScore,
    readyForSubmissionBoolean,
    readyForFinalBillingBoolean,
    readyForRetainageReleaseBoolean,
    readyForArchiveBoolean,
    missingRequiredDocuments,
    unresolvedPunchItems,
    missingTestRecords,
    missingAsBuilts,
    unresolvedRfisOrSubmittals,
    unresolvedChangeEvents: projectChanges,
    unbilledApprovedChanges,
    finalBillingBlockers,
    retainageReleaseBlockers,
    acceptanceBlockers,
    archiveBlockers,
    warnings: [
      ...photoGaps.map((item) => `${item.projectName}: daily report ${item.id} has photo gaps.`),
      ...fieldTestGaps.map((item) => `${item.projectName}: daily report ${item.id} has test evidence gaps.`),
      ...(project ? project.missingArtifacts.map((item) => `${project.name}: ${item} remains missing.`) : [])
    ],
    requiredActions: requiredActions.slice(0, 10),
    nextActions: [
      closeoutPackage.nextAction,
      ...missingRequiredDocuments.map((item) => item.nextAction),
      ...unresolvedPunchItems.map((item) => item.nextAction),
      ...missingTestRecords.map((item) => item.nextAction)
    ].filter(Boolean).slice(0, 10),
    recommendedDecision
  };
}
