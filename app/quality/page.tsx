import Link from "next/link";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { QualityDashboard } from "@/components/d5o/quality/QualityDashboard";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { evaluateQualityControl } from "@/lib/d5o/quality-control";
import {
  correctiveActions,
  punchItems,
  qualityDeficiencies,
  qualityInspections,
  testRecords
} from "@/lib/d5o/seed-data";

const qualityActions = correctiveActions.filter((action) =>
  action.sourceType === "quality_deficiency" || action.sourceType === "quality_inspection" || action.sourceType === "punch_item"
);
const summary = evaluateQualityControl({
  inspections: qualityInspections,
  deficiencies: qualityDeficiencies,
  tests: testRecords,
  punchItems,
  correctiveActions: qualityActions
});
const inspectionsDue = qualityInspections.filter((inspection) => ["scheduled", "overdue", "blocked"].includes(inspection.status));
const completedInspections = qualityInspections.filter((inspection) => ["passed", "closed", "verified"].includes(inspection.status));
const openDeficiencies = qualityDeficiencies.filter((item) => !["closed", "verified"].includes(item.status));
const missingTests = testRecords.filter((test) => test.requiredForCloseout && (test.attachments.length === 0 || ["failed", "overdue", "blocked"].includes(test.status)));
const openPunch = punchItems.filter((item) => !["closed", "verified"].includes(item.status));
const blockedProjects = new Set(summary.blockers.map((item) => item.split(":")[0]));

export const metadata = {
  title: "Quality | RybexOS"
};

export default function QualityPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context={`Quality control score: ${summary.qualityControlScore}%`}
        eyebrow="D4 / D5 Quality Control"
        primaryAction={{ href: "/quality/inspection/new", label: "New Inspection", tone: "primary" }}
        secondaryActions={[
          { href: "/quality/deficiency/new", label: "New Deficiency / Punch Item" },
          { href: "/command-center", label: "Command Center" }
        ]}
        subtitle="Control inspections, deficiencies, tests, punch items, and acceptance evidence."
        tags={["Acceptance evidence"]}
        title="Quality"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("quality")} />

      <CollapsedDetails
        title="Quality records"
        summary="Inspection, deficiency, test, punch, corrective action, and closeout evidence details."
      >
      <section className="pipeline-guardrail">
        <strong>Quality operating discipline:</strong>
        <span>Inspections, test results, required photos, deficiencies, and punch items must be controlled while work is still visible and recoverable.</span>
      </section>

      <WorkflowModuleContext
        queueTitle="Quality-control workflow actions"
        workflowType="quality_control"
      />

      <section className="metrics-grid" aria-label="Quality summary">
        <PipelineSummaryMetric detail="Scheduled, overdue, or blocked" label="Inspections Due" tone={inspectionsDue.length > 0 ? "warning" : "success"} value={inspectionsDue.length} />
        <PipelineSummaryMetric detail="Passed, verified, or closed" label="Completed Inspections" tone="success" value={completedInspections.length} />
        <PipelineSummaryMetric detail="Open quality deficiency records" label="Open Deficiencies" tone={openDeficiencies.length > 0 ? "critical" : "success"} value={openDeficiencies.length} />
        <PipelineSummaryMetric detail="Quality corrective actions overdue" label="Overdue Actions" tone={summary.overdueActions.length > 0 ? "critical" : "success"} value={summary.overdueActions.length} />
        <PipelineSummaryMetric detail="Required test evidence missing" label="Tests Missing" tone={missingTests.length > 0 ? "critical" : "success"} value={missingTests.length} />
        <PipelineSummaryMetric detail="Open punch records" label="Punch Items" tone={openPunch.length > 0 ? "warning" : "success"} value={openPunch.length} />
        <PipelineSummaryMetric detail="Photos/tests/reinspection gaps" label="Evidence Gaps" tone={summary.missingEvidence.length > 0 ? "critical" : "success"} value={summary.missingEvidence.length} />
        <PipelineSummaryMetric detail="Projects blocked by quality" label="Projects Blocked" tone={blockedProjects.size > 0 ? "critical" : "success"} value={blockedProjects.size} />
      </section>

      <QualityDashboard
        inspections={qualityInspections}
        deficiencies={qualityDeficiencies}
        tests={testRecords}
        punchItems={punchItems}
        correctiveActions={qualityActions}
      />

      <section className="pipeline-guardrail">
        <strong>D5 evidence handoff:</strong>
        <span>
          Open punch items, missing tests, failed inspections, and unresolved deficiencies feed the <Link href="/closeout">Closeout</Link> acceptance package.
        </span>
      </section>
      </CollapsedDetails>
    </div>
  );
}
