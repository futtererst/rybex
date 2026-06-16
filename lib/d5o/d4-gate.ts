import { evaluateD3Gate } from "./d3-gate";
import type {
  D4GateReadiness,
  DailyReport,
  FieldExecutionDecision,
  MobilizationPlan,
  ProductionStatus,
  RybexProject,
  WorkPackage
} from "./types";

const completeReportStatuses = ["submitted", "supervisor_review", "approved"] as const;

export function evaluateD4Gate({
  reports,
  workPackages,
  mobilizationPlan,
  project
}: {
  reports: DailyReport[];
  workPackages: WorkPackage[];
  mobilizationPlan?: MobilizationPlan;
  project?: RybexProject;
}): D4GateReadiness {
  const missingRequiredRecords: string[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requiredActions: string[] = [];

  if (mobilizationPlan) {
    const d3Readiness = evaluateD3Gate(mobilizationPlan, project);

    if (!d3Readiness.readyBoolean && mobilizationPlan.readinessStatus !== "field_started") {
      blockers.push("D3 field-start approval is not complete.");
      requiredActions.push("Resolve D3 blockers before continuing D4 production.");
    }
  } else {
    warnings.push("No mobilization plan is linked to this field execution record.");
  }

  if (workPackages.length === 0) {
    missingRequiredRecords.push("Active work package");
    blockers.push("No active work package is available for field execution.");
  }

  const missingReports = reports.filter((report) => report.reportStatus === "missing");
  const lateReports = reports.filter((report) => report.reportStatus === "late");
  const controlledReports = reports.filter((report) =>
    completeReportStatuses.includes(report.reportStatus as (typeof completeReportStatuses)[number])
  );

  if (reports.length === 0 || missingReports.length > 0) {
    missingRequiredRecords.push("Daily report");
    blockers.push("One or more daily reports are missing.");
    requiredActions.push("Submit missing daily reports with quantities, photos, delays, and signoff.");
  }

  if (lateReports.length > 0) {
    warnings.push(`${lateReports.length} daily report(s) are late.`);
  }

  const photoGaps = reports.filter((report) => !report.requiredPhotosComplete);
  const testGaps = reports.filter((report) => !report.requiredTestsComplete);
  const quantityGaps = reports.filter((report) => report.installedQuantities.length === 0);
  const signoffGaps = reports.filter((report) => report.supervisorSignoff.status !== "signed");
  const safetyOpen = reports.flatMap((report) =>
    [...report.safetyObservations, ...report.safetyIncidents].filter(
      (item) => item.status !== "closed"
    )
  );
  const qualityOpen = reports.flatMap((report) =>
    [...report.qualityChecks, ...report.qualityDeficiencies].filter(
      (item) => item.status !== "passed"
    )
  );
  const documentedDelays = reports.flatMap((report) => report.delays);
  const changedConditions = reports.flatMap((report) => report.changedConditions);
  const rfiPrompts = reports.filter((report) => report.rfiNeeded);
  const changePrompts = reports.filter((report) => report.changeEventNeeded);

  if (photoGaps.length > 0) {
    missingRequiredRecords.push("Required field photos");
    warnings.push("Required photos are missing for one or more work days.");
    requiredActions.push("Capture or attach required photos before closeout evidence is at risk.");
  }

  if (testGaps.length > 0) {
    missingRequiredRecords.push("Required tests");
    warnings.push("Required tests are not complete for one or more work days.");
  }

  if (quantityGaps.length > 0) {
    missingRequiredRecords.push("Installed quantities");
    warnings.push("Installed quantities are missing from daily reports.");
  }

  if (signoffGaps.length > 0) {
    missingRequiredRecords.push("Supervisor signoff");
    warnings.push("Supervisor signoff is pending on one or more daily reports.");
  }

  if (safetyOpen.length > 0) {
    blockers.push("Open safety observations or incidents require action.");
    requiredActions.push("Escalate unresolved safety observations before the next shift.");
  }

  if (qualityOpen.length > 0) {
    blockers.push("Open quality deficiencies require correction or escalation.");
    requiredActions.push("Assign quality corrective action and attach evidence.");
  }

  if (documentedDelays.some((delay) => delay.scheduleImpact || delay.costImpact)) {
    warnings.push("Delay records include schedule or cost impact.");
  }

  if (changedConditions.length > 0 && (rfiPrompts.length > 0 || changePrompts.length > 0)) {
    requiredActions.push("Create or link RFI/change event before notice windows are missed.");
  }

  const productionHealth = getProductionHealth(reports, workPackages);
  const documentationHealth = getDocumentationHealth(photoGaps.length, testGaps.length, quantityGaps.length, signoffGaps.length);
  const safetyHealth = safetyOpen.some((item) => item.severity === "critical" || item.severity === "high")
    ? "blocked"
    : safetyOpen.length > 0
      ? "at_risk"
      : "healthy";
  const qualityHealth = qualityOpen.some((item) => item.status === "rework_required")
    ? "blocked"
    : qualityOpen.length > 0
      ? "at_risk"
      : "healthy";

  const checks = [
    mobilizationPlan ? evaluateD3Gate(mobilizationPlan, project).readyBoolean || mobilizationPlan.readinessStatus === "field_started" : false,
    workPackages.length > 0,
    reports.length > 0 && missingReports.length === 0,
    controlledReports.length === reports.length,
    photoGaps.length === 0,
    testGaps.length === 0,
    quantityGaps.length === 0,
    safetyOpen.length === 0,
    qualityOpen.length === 0,
    signoffGaps.length === 0,
    !["behind", "blocked"].includes(productionHealth)
  ];

  const controlScore = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100
  );

  return {
    controlScore,
    readyForCloseoutReviewBoolean:
      controlScore >= 88 &&
      blockers.length === 0 &&
      workPackages.every((workPackage) => ["complete", "in_progress"].includes(workPackage.status)),
    missingRequiredRecords: Array.from(new Set(missingRequiredRecords)),
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
    recommendedDecision: getRecommendedDecision({
      blockers,
      safetyOpen,
      qualityOpen,
      rfiPrompts,
      changePrompts,
      productionHealth,
      controlScore
    }),
    requiredActions: Array.from(new Set(requiredActions)),
    productionHealth,
    documentationHealth,
    safetyHealth,
    qualityHealth
  };
}

function getProductionHealth(reports: DailyReport[], workPackages: WorkPackage[]): ProductionStatus {
  if (workPackages.some((workPackage) => workPackage.status === "blocked")) {
    return "blocked";
  }

  if (workPackages.every((workPackage) => workPackage.status === "complete")) {
    return "complete";
  }

  if (reports.some((report) => report.productionStatus === "blocked")) {
    return "blocked";
  }

  if (reports.some((report) => report.productionStatus === "behind")) {
    return "behind";
  }

  if (reports.some((report) => report.productionStatus === "ahead")) {
    return "ahead";
  }

  return reports.length > 0 ? "on_plan" : "not_started";
}

function getDocumentationHealth(
  photoGapCount: number,
  testGapCount: number,
  quantityGapCount: number,
  signoffGapCount: number
) {
  const totalGaps = photoGapCount + testGapCount + quantityGapCount + signoffGapCount;

  if (totalGaps === 0) {
    return "healthy";
  }

  if (photoGapCount > 1 || testGapCount > 1 || signoffGapCount > 2) {
    return "blocked";
  }

  return totalGaps > 2 ? "at_risk" : "watch";
}

function getRecommendedDecision({
  blockers,
  safetyOpen,
  qualityOpen,
  rfiPrompts,
  changePrompts,
  productionHealth,
  controlScore
}: {
  blockers: string[];
  safetyOpen: DailyReport["safetyObservations"];
  qualityOpen: DailyReport["qualityChecks"];
  rfiPrompts: DailyReport[];
  changePrompts: DailyReport[];
  productionHealth: ProductionStatus;
  controlScore: number;
}): FieldExecutionDecision {
  if (safetyOpen.some((item) => item.severity === "critical")) {
    return "hold_work";
  }

  if (safetyOpen.length > 0) {
    return "create_safety_action";
  }

  if (qualityOpen.length > 0) {
    return "create_quality_action";
  }

  if (changePrompts.length > 0) {
    return "create_change_event";
  }

  if (rfiPrompts.length > 0) {
    return "create_rfi";
  }

  if (blockers.length > 0 || productionHealth === "blocked") {
    return "escalate_issue";
  }

  if (controlScore >= 88 && productionHealth === "complete") {
    return "ready_for_closeout_review";
  }

  return "continue_work";
}
