import Link from "next/link";
import { CloseoutDashboard } from "@/components/d5o/closeout/CloseoutDashboard";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { getCloseoutData } from "@/lib/d5o/data";
import { evaluateD5Gate } from "@/lib/d5o/d5-gate";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";

const {
  acceptanceRecords,
  asBuiltRecords,
  changeEvents,
  closeoutPackages,
  closeoutRequirements,
  correctiveActions,
  dailyReports,
  lienWaivers,
  payApplications,
  projects,
  punchItems,
  qualityDeficiencies,
  rfis,
  submittals,
  testRecords,
  warrantyRecords
} = getCloseoutData();

const packageReadiness = closeoutPackages.map((closeoutPackage) => evaluateD5Gate({
  closeoutPackage,
  project: projects.find((project) => project.id === closeoutPackage.projectId),
  requirements: closeoutRequirements,
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
}));
const readyForReview = closeoutPackages.filter((item) => ["ready_for_review", "submitted", "accepted"].includes(item.status));
const blockedPackages = closeoutPackages.filter((item) => item.status === "missing_requirements" || item.blockers.length > 0);
const openPunchItems = punchItems.filter((item) => item.closeoutImpact && !["closed", "verified"].includes(item.status));
const missingTests = testRecords.filter((item) => item.requiredForCloseout && (item.attachments.length === 0 || ["not_started", "draft", "failed", "overdue", "blocked"].includes(item.status)));
const missingAsBuilts = closeoutRequirements.filter((item) => ["as_built", "redline"].includes(item.category) && !["accepted", "waived", "archived"].includes(item.status));
const finalBillingBlockers = packageReadiness.reduce((total, item) => total + item.finalBillingBlockers.length, 0);
const retainageBlockers = packageReadiness.reduce((total, item) => total + item.retainageReleaseBlockers.length, 0);
const acceptancePending = acceptanceRecords.filter((item) => ["submitted", "under_review", "accepted_with_exceptions"].includes(item.status));

export const metadata = {
  title: "Closeout | RybexOS"
};

export default function CloseoutPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context="Acceptance package control across field proof, quality evidence, commercial recovery, and final handoff."
        eyebrow="D5 Document / Close"
        primaryAction={{ href: "/closeout/package/new", label: "New Closeout Package", tone: "primary" }}
        secondaryActions={[
          { href: "#acceptance-risks", label: "Review Acceptance Risks" },
          { href: "/command-center", label: "Command Center" }
        ]}
        subtitle="Convert completed work into acceptance, final billing readiness, retainage release, and archive-quality documentation."
        tags={["Acceptance package"]}
        title="Closeout"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("closeout")} />

      <CollapsedDetails
        title="Closeout records"
        summary="Packages, missing requirements, acceptance, final billing, retainage, and archive details."
      >
        <section className="pipeline-guardrail">
          <strong>D5 closeout discipline:</strong>
          <span>As-builts, tests, photos, punch, safety/quality records, RFI/change closure, final billing, waivers, retainage, and acceptance must align before archive.</span>
        </section>

        <WorkflowModuleContext
          queueTitle="D5 acceptance workflow actions"
          workflowType="closeout_acceptance"
        />

        <section className="metrics-grid detail-metrics-grid" aria-label="Closeout summary">
          <PipelineSummaryMetric detail="Active acceptance packages" label="Projects in Closeout" value={closeoutPackages.length} />
          <PipelineSummaryMetric detail="Ready, submitted, or accepted" label="Ready for Review" tone="success" value={readyForReview.length} />
          <PipelineSummaryMetric detail="Blocked by missing evidence or terms" label="Packages Blocked" tone={blockedPackages.length > 0 ? "critical" : "success"} value={blockedPackages.length} />
          <PipelineSummaryMetric detail="Punch items affecting acceptance" label="Open Punch" tone={openPunchItems.length > 0 ? "critical" : "success"} value={openPunchItems.length} />
          <PipelineSummaryMetric detail="Required closeout tests missing" label="Missing Tests" tone={missingTests.length > 0 ? "critical" : "success"} value={missingTests.length} />
          <PipelineSummaryMetric detail="As-builts or redlines missing" label="As-builts Missing" tone={missingAsBuilts.length > 0 ? "critical" : "success"} value={missingAsBuilts.length} />
          <PipelineSummaryMetric detail="Final billing blockers" label="Final Billing" tone={finalBillingBlockers > 0 ? "critical" : "success"} value={finalBillingBlockers} />
          <PipelineSummaryMetric detail="Retainage release blockers" label="Retainage" tone={retainageBlockers > 0 ? "warning" : "success"} value={retainageBlockers} />
          <PipelineSummaryMetric detail="Submitted or under review" label="Acceptance Pending" tone={acceptancePending.length > 0 ? "warning" : "success"} value={acceptancePending.length} />
        </section>

        <div id="acceptance-risks" className="detail-contained">
          <CloseoutDashboard
            packages={closeoutPackages}
            requirements={closeoutRequirements}
            acceptanceRecords={acceptanceRecords}
            asBuiltRecords={asBuiltRecords}
            warrantyRecords={warrantyRecords}
            projects={projects}
            dailyReports={dailyReports}
            punchItems={punchItems}
            testRecords={testRecords}
            qualityDeficiencies={qualityDeficiencies}
            correctiveActions={correctiveActions}
            rfis={rfis}
            submittals={submittals}
            changeEvents={changeEvents}
            payApplications={payApplications}
            lienWaivers={lienWaivers}
          />
        </div>

        <section className="pipeline-guardrail">
          <strong>O handoff:</strong>
          <span>
            Accepted or closeout-ready packages should feed a <Link href="/reports/lessons-learned/new">lessons learned review</Link> so production rates, partner posture, and risk controls improve.
          </span>
        </section>
      </CollapsedDetails>
    </div>
  );
}
