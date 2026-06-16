import type {
  GcPerformanceProfile,
  ImprovementAction,
  LessonLearned,
  ProductionRateRecord,
  ProjectPerformanceScorecard,
  RiskLibraryItem,
  VendorPerformanceProfile
} from "./types";

const today = "2026-06-10";
const needsActionStatuses = ["open", "assigned", "in_progress", "overdue"];

export type OptimizeControlSummary = {
  operatingImprovementScore: number;
  marginVarianceSummary: number;
  productionVarianceSummary: number;
  changeRecoverySummary: number;
  safetyQualitySummary: number;
  gcPerformanceRisks: GcPerformanceProfile[];
  vendorPerformanceRisks: VendorPerformanceProfile[];
  rateUpdateRecommendations: ProductionRateRecord[];
  riskLibraryUpdateRecommendations: RiskLibraryItem[];
  overdueImprovementActions: ImprovementAction[];
  requiredActions: string[];
  nextActions: string[];
};

export function evaluateOptimizeControl({
  scorecards,
  lessons,
  productionRates,
  gcProfiles,
  vendorProfiles,
  improvementActions,
  riskLibrary
}: {
  scorecards: ProjectPerformanceScorecard[];
  lessons: LessonLearned[];
  productionRates: ProductionRateRecord[];
  gcProfiles: GcPerformanceProfile[];
  vendorProfiles: VendorPerformanceProfile[];
  improvementActions: ImprovementAction[];
  riskLibrary: RiskLibraryItem[];
}): OptimizeControlSummary {
  const average = (values: number[]) =>
    values.length > 0 ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;

  const marginVarianceSummary = Math.round(
    scorecards.reduce((total, scorecard) => total + scorecard.marginVariance, 0)
  );
  const productionVarianceSummary = average(scorecards.map((scorecard) => scorecard.productionVariancePercent));
  const changeRecoverySummary = average(scorecards.map((scorecard) => scorecard.changeRecoveryRate));
  const safetyQualitySummary = average(scorecards.map((scorecard) =>
    Math.round((scorecard.safetyScore + scorecard.qualityScore) / 2)
  ));
  const gcPerformanceRisks = gcProfiles.filter((profile) =>
    profile.recommendedPursuitPosture === "caution" ||
    profile.recommendedPursuitPosture === "avoid" ||
    profile.disputeRiskScore > 65 ||
    profile.overallScore < 70
  );
  const vendorPerformanceRisks = vendorProfiles.filter((profile) =>
    profile.recommendedUsePosture === "probation" ||
    profile.recommendedUsePosture === "avoid" ||
    profile.overallScore < 70
  );
  const rateUpdateRecommendations = productionRates.filter((rate) =>
    Math.abs(rate.variancePercent) >= 12 && rate.confidenceLevel !== "low"
  );
  const riskLibraryUpdateRecommendations = riskLibrary.filter((risk) =>
    risk.shouldUpdateGoNoGoScoring ||
    risk.shouldUpdateEstimateAssumptions ||
    risk.shouldUpdateMobilizationChecklist ||
    risk.shouldUpdateWorkPackageTemplate
  );
  const overdueImprovementActions = improvementActions.filter((action) =>
    needsActionStatuses.includes(action.status) && action.dueDate < today
  );
  const openLessons = lessons.filter((lesson) =>
    ["open", "assigned", "in_progress"].includes(lesson.status)
  );
  const operatingImprovementScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        average(scorecards.map((scorecard) => scorecard.overallProjectScore)) -
          overdueImprovementActions.length * 3 -
          gcPerformanceRisks.length * 2 -
          vendorPerformanceRisks.length * 2 -
          rateUpdateRecommendations.length
      )
    )
  );

  return {
    operatingImprovementScore,
    marginVarianceSummary,
    productionVarianceSummary,
    changeRecoverySummary,
    safetyQualitySummary,
    gcPerformanceRisks,
    vendorPerformanceRisks,
    rateUpdateRecommendations,
    riskLibraryUpdateRecommendations,
    overdueImprovementActions,
    requiredActions: [
      ...overdueImprovementActions.map((action) => action.title),
      ...rateUpdateRecommendations.map((rate) => `Update ${rate.workType} estimating rate.`),
      ...gcPerformanceRisks.map((profile) => `Review pursuit posture for ${profile.gcClient}.`),
      ...vendorPerformanceRisks.map((profile) => `Review vendor posture for ${profile.vendorName}.`)
    ].slice(0, 10),
    nextActions: [
      ...openLessons.map((lesson) => lesson.actionRequired),
      ...improvementActions.filter((action) => needsActionStatuses.includes(action.status)).map((action) => action.description),
      ...riskLibraryUpdateRecommendations.map((risk) => risk.recommendedMitigation)
    ].filter(Boolean).slice(0, 10)
  };
}
