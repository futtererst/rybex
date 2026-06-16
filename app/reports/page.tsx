import Link from "next/link";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { OptimizeDashboard } from "@/components/d5o/optimize/OptimizeDashboard";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { getOptimizeData } from "@/lib/d5o/data";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { evaluateOptimizeControl } from "@/lib/d5o/optimize-control";

const {
  gcPerformanceProfiles,
  improvementActions,
  lessonsLearned,
  productionRateRecords,
  projectPerformanceScorecards,
  riskLibraryItems,
  vendorPerformanceProfiles
} = getOptimizeData();

const summary = evaluateOptimizeControl({
  scorecards: projectPerformanceScorecards,
  lessons: lessonsLearned,
  productionRates: productionRateRecords,
  gcProfiles: gcPerformanceProfiles,
  vendorProfiles: vendorPerformanceProfiles,
  improvementActions,
  riskLibrary: riskLibraryItems
});
const completedReviewed = projectPerformanceScorecards.length;
const averageGcScore = Math.round(gcPerformanceProfiles.reduce((total, item) => total + item.overallScore, 0) / gcPerformanceProfiles.length);
const averageVendorScore = Math.round(vendorPerformanceProfiles.reduce((total, item) => total + item.overallScore, 0) / vendorPerformanceProfiles.length);
const averageCloseoutCycle = Math.round(projectPerformanceScorecards.reduce((total, item) => total + item.closeoutCycleTimeDays, 0) / projectPerformanceScorecards.length);
const openActions = improvementActions.filter((action) => !["closed", "verified", "implemented"].includes(action.status));

export const metadata = {
  title: "Optimize | RybexOS"
};

export default function ReportsPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context="Closed-loop performance intelligence across the D5O lifecycle."
        eyebrow="O Optimize"
        primaryAction={{ href: "/reports/lessons-learned/new", label: "New Lessons Learned Review", tone: "primary" }}
        secondaryActions={[
          { href: "#production-rates", label: "Review Production Rates" },
          { href: "/command-center", label: "Command Center" }
        ]}
        subtitle="Convert completed work into production intelligence, lessons learned, and better future execution."
        tags={["Learning loop"]}
        title="Optimize"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("reports")} />

      <CollapsedDetails
        title="Optimize records"
        summary="Scorecards, lessons learned, production rates, GC/vendor profiles, risk library, and improvement backlog."
      >
        <section className="pipeline-guardrail">
          <strong>Optimize discipline:</strong>
          <span>Lessons learned must update pursuit scoring, estimating rates, mobilization checklists, work packages, and closeout standards.</span>
        </section>

        <WorkflowModuleContext
          queueTitle="Optimize-learning workflow actions"
          workflowType="optimize_learning"
        />

        <section className="metrics-grid detail-metrics-grid" aria-label="Optimize summary">
          <PipelineSummaryMetric detail="Completed projects reviewed" label="Projects Reviewed" value={completedReviewed} />
          <PipelineSummaryMetric detail="Aggregate margin variance points" label="Margin Variance" tone={summary.marginVarianceSummary < 0 ? "critical" : "success"} value={`${summary.marginVarianceSummary} pts`} />
          <PipelineSummaryMetric detail="Average production variance" label="Production Variance" tone={summary.productionVarianceSummary < -10 ? "critical" : "warning"} value={`${summary.productionVarianceSummary}%`} />
          <PipelineSummaryMetric detail="Average change recovery rate" label="Change Recovery" tone={summary.changeRecoverySummary < 70 ? "critical" : "success"} value={`${summary.changeRecoverySummary}%`} />
          <PipelineSummaryMetric detail="Combined safety/quality score" label="Safety / Quality" tone={summary.safetyQualitySummary < 75 ? "warning" : "success"} value={summary.safetyQualitySummary} />
          <PipelineSummaryMetric detail="Average D5 cycle time" label="Closeout Cycle" tone={averageCloseoutCycle > 25 ? "warning" : "success"} value={`${averageCloseoutCycle}d`} />
          <PipelineSummaryMetric detail="Average GC/client score" label="GC Score" tone={averageGcScore < 70 ? "warning" : "success"} value={averageGcScore} />
          <PipelineSummaryMetric detail="Average vendor score" label="Vendor Score" tone={averageVendorScore < 70 ? "warning" : "success"} value={averageVendorScore} />
          <PipelineSummaryMetric detail="Open improvement backlog" label="Open Actions" tone={openActions.length > 0 ? "critical" : "success"} value={openActions.length} />
        </section>

        <div id="production-rates" className="detail-contained">
          <OptimizeDashboard
            scorecards={projectPerformanceScorecards}
            lessons={lessonsLearned}
            productionRates={productionRateRecords}
            gcProfiles={gcPerformanceProfiles}
            vendorProfiles={vendorPerformanceProfiles}
            improvementActions={improvementActions}
            riskLibrary={riskLibraryItems}
          />
        </div>
      </CollapsedDetails>
    </div>
  );
}
