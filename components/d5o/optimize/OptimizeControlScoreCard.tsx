import { evaluateOptimizeControl } from "@/lib/d5o/optimize-control";
import type { GcPerformanceProfile, ImprovementAction, LessonLearned, ProductionRateRecord, ProjectPerformanceScorecard, RiskLibraryItem, VendorPerformanceProfile } from "@/lib/d5o/types";

export function OptimizeControlScoreCard(props: {
  scorecards: ProjectPerformanceScorecard[];
  lessons: LessonLearned[];
  productionRates: ProductionRateRecord[];
  gcProfiles: GcPerformanceProfile[];
  vendorProfiles: VendorPerformanceProfile[];
  improvementActions: ImprovementAction[];
  riskLibrary: RiskLibraryItem[];
}) {
  const summary = evaluateOptimizeControl(props);

  return (
    <section className="score-card">
      <span className="metric-label">Operating Improvement Score</span>
      <strong>{summary.operatingImprovementScore}%</strong>
      <p>Closed-loop learning across margin, production, partner behavior, and action follow-through.</p>
      <ul className="plain-list">
        <li>{summary.rateUpdateRecommendations.length} production rate update(s)</li>
        <li>{summary.overdueImprovementActions.length} overdue action(s)</li>
        <li>{summary.gcPerformanceRisks.length + summary.vendorPerformanceRisks.length} partner performance risk(s)</li>
      </ul>
    </section>
  );
}
