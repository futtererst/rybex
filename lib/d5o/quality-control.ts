import type {
  CorrectiveAction,
  PunchItem,
  QualityDeficiency,
  QualityInspection,
  TestRecord
} from "./types";

const today = "2026-06-10";
const isOpen = (status: string) => !["closed", "verified", "passed"].includes(status);
const isOverdue = (date: string | undefined, status: string) => Boolean(date && isOpen(status) && date < today);

export type QualityControlSummary = {
  qualityControlScore: number;
  blockers: string[];
  warnings: string[];
  overdueActions: CorrectiveAction[];
  missingEvidence: string[];
  failedInspectionItems: QualityInspection[];
  punchCloseoutRisks: PunchItem[];
  requiredActions: string[];
  nextActions: string[];
};

export function evaluateQualityControl({
  inspections,
  deficiencies,
  tests,
  punchItems,
  correctiveActions
}: {
  inspections: QualityInspection[];
  deficiencies: QualityDeficiency[];
  tests: TestRecord[];
  punchItems: PunchItem[];
  correctiveActions: CorrectiveAction[];
}): QualityControlSummary {
  const inspectionsDue = inspections.filter((inspection) =>
    ["scheduled", "overdue", "blocked"].includes(inspection.status)
  );
  const failedInspectionItems = inspections.filter((inspection) =>
    inspection.status === "failed" || inspection.passFailResult === "fail"
  );
  const openDeficiencies = deficiencies.filter((deficiency) => isOpen(deficiency.status));
  const overdueActions = correctiveActions.filter((action) =>
    action.sourceType !== "safety_observation" && action.sourceType !== "safety_incident" && isOverdue(action.dueDate, action.status)
  );
  const missingPhotos = inspections.filter((inspection) => inspection.closeoutRequired && !inspection.photosComplete);
  const missingTests = tests.filter((test) =>
    test.requiredForCloseout && (["not_started", "draft", "failed", "overdue", "blocked"].includes(test.status) || test.attachments.length === 0)
  );
  const punchCloseoutRisks = punchItems.filter((item) =>
    item.closeoutImpact && isOpen(item.status)
  );
  const reinspectionRequired = deficiencies.filter((deficiency) =>
    deficiency.reinspectionRequired && !["verified", "closed", "passed"].includes(deficiency.reinspectionStatus)
  );

  const missingEvidence = [
    ...missingPhotos.map((inspection) => `${inspection.projectName}: photos missing for ${inspection.title}`),
    ...missingTests.map((test) => `${test.projectName}: ${test.title}`),
    ...reinspectionRequired.map((deficiency) => `${deficiency.projectName}: reinspection required for ${deficiency.title}`)
  ];
  const blockers = [
    ...failedInspectionItems.map((inspection) => `${inspection.projectName}: failed ${inspection.title}`),
    ...openDeficiencies.filter((item) => ["high", "critical"].includes(item.severity)).map((item) => `${item.projectName}: ${item.title}`),
    ...punchCloseoutRisks.map((item) => `${item.projectName}: ${item.title}`)
  ];
  const warnings = [
    ...inspectionsDue.map((inspection) => `${inspection.projectName}: ${inspection.title} is due.`),
    ...missingEvidence,
    ...overdueActions.map((action) => `${action.projectName}: ${action.title} is overdue.`)
  ];
  const totalSignals = inspections.length + deficiencies.length + tests.length + punchItems.length + correctiveActions.length;
  const openRiskCount =
    inspectionsDue.length +
    failedInspectionItems.length +
    openDeficiencies.length +
    overdueActions.length +
    missingPhotos.length +
    missingTests.length +
    punchCloseoutRisks.length +
    reinspectionRequired.length;
  const qualityControlScore = Math.max(0, Math.min(100, Math.round(100 - (openRiskCount / Math.max(totalSignals, 1)) * 100)));

  return {
    qualityControlScore,
    blockers,
    warnings,
    overdueActions,
    missingEvidence,
    failedInspectionItems,
    punchCloseoutRisks,
    requiredActions: blockers.slice(0, 6),
    nextActions: [
      ...failedInspectionItems.map((inspection) => inspection.nextAction),
      ...openDeficiencies.map((deficiency) => deficiency.nextAction),
      ...punchCloseoutRisks.map((item) => item.nextAction),
      ...missingTests.map((test) => test.nextAction)
    ].filter(Boolean).slice(0, 6)
  };
}
