import Link from "next/link";
import { CloseoutFinalBillingWorkflowClient } from "@/components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient";
import { CloseoutDashboard } from "@/components/d5o/closeout/CloseoutDashboard";
import { CollapsedDetails } from "@/components/d5o/end-user";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import {
  getCloseoutFinalBillingActionState,
  getCloseoutFinalBillingSeedDataOverlay
} from "@/lib/d5o/closeout-final-billing/store";
import { getCloseoutData } from "@/lib/d5o/data";
import { evaluateD5Gate } from "@/lib/d5o/d5-gate";

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

export const dynamic = "force-dynamic";

export default async function CloseoutPage() {
  const closeoutFinalBillingState = await getCloseoutFinalBillingActionState();
  const closeoutOverlay = await getCloseoutFinalBillingSeedDataOverlay({
    closeoutPackages,
    closeoutRequirements,
    acceptanceRecords,
    payApplications,
    lienWaivers
  });
  const pageCloseoutPackages = closeoutOverlay.closeoutPackages;
  const pageCloseoutRequirements = closeoutOverlay.closeoutRequirements;
  const pageAcceptanceRecords = closeoutOverlay.acceptanceRecords;
  const pagePayApplications = closeoutOverlay.payApplications;
  const pageLienWaivers = closeoutOverlay.lienWaivers;
  const packageReadiness = pageCloseoutPackages.map((closeoutPackage) => evaluateD5Gate({
    closeoutPackage,
    project: projects.find((project) => project.id === closeoutPackage.projectId),
    requirements: pageCloseoutRequirements,
    acceptanceRecords: pageAcceptanceRecords,
    dailyReports,
    punchItems,
    testRecords,
    qualityDeficiencies,
    correctiveActions,
    rfis,
    submittals,
    changeEvents,
    payApplications: pagePayApplications,
    lienWaivers: pageLienWaivers
  }));
  const readyForReview = pageCloseoutPackages.filter((item) => ["ready_for_review", "submitted", "accepted"].includes(item.status));
  const blockedPackages = pageCloseoutPackages.filter((item) => item.status === "missing_requirements" || item.blockers.length > 0);
  const openPunchItems = punchItems.filter((item) => item.closeoutImpact && !["closed", "verified"].includes(item.status));
  const missingTests = testRecords.filter((item) => item.requiredForCloseout && (item.attachments.length === 0 || ["not_started", "draft", "failed", "overdue", "blocked"].includes(item.status)));
  const missingAsBuilts = pageCloseoutRequirements.filter((item) => ["as_built", "redline"].includes(item.category) && !["accepted", "waived", "archived"].includes(item.status));
  const finalBillingBlockers = packageReadiness.reduce((total, item) => total + item.finalBillingBlockers.length, 0);
  const retainageBlockers = packageReadiness.reduce((total, item) => total + item.retainageReleaseBlockers.length, 0);
  const acceptancePending = pageAcceptanceRecords.filter((item) => ["submitted", "under_review", "accepted_with_exceptions"].includes(item.status));
  const closeoutResolved = closeoutFinalBillingState.blocker.state === "resolved";
  const requiredCloseoutEvidence = closeoutFinalBillingState.blocker.evidenceRequirements.filter((item) => item.required);
  const completedCloseoutEvidenceCount = requiredCloseoutEvidence.filter((item) => item.status === "attached").length;
  const closeoutAmount = closeoutFinalBillingState.blocker.retainageExposureAmount.toLocaleString("en-US", { currency: "USD", style: "currency", maximumFractionDigits: 0 });

  return (
    <div className={`command-grid closeout-page active-workbench-page ${closeoutResolved ? "closeout-page-resolved" : "closeout-page-unresolved"}`}>
      <PageHeader
        context={closeoutResolved
          ? "The closeout blocker is cleared. Continue final billing and retainage processing before payment is recorded."
          : "Use the active release workbench to clear the closeout blocker before returning to package records."}
        eyebrow="Final Billing Release"
        subtitle={closeoutResolved
          ? "Closeout approval is recorded and the linked final billing item can continue processing."
          : "Release final billing and retainage by closing acceptance, evidence, and approval gaps."}
        tags={closeoutResolved ? ["Ready for final billing processing"] : ["Final cash release"]}
        title="Closeout"
      />

      <section
        className="workbench-situation-hero closeout-situation-hero"
        data-closeout-resolved-primary-surface={closeoutResolved ? "summary" : undefined}
        data-qa="closeout-situation-hero"
      >
        <div className="workbench-situation-copy closeout-situation-copy">
          <p className="eyebrow">Final billing release</p>
          <h2>{closeoutResolved ? "Closeout blocker cleared" : "Release final billing"}</h2>
          <p>
            {closeoutResolved
              ? `The closeout requirement is complete and the linked final billing item is ready for processing. Payment has not yet been recorded.`
              : "Complete this workflow to close acceptance, evidence, and approval gaps so final billing and retainage can be released."}
          </p>
          <p className="mobile-workbench-summary">
            {closeoutResolved
              ? `Closeout blocker cleared. ${closeoutAmount} unblocked for final billing and retainage processing. Closeout requirement complete; acceptance/evidence complete. Release approval recorded. Billing projection updated. Command Center updated. Payment has not yet been recorded.`
              : `${closeoutAmount} blocked. Final billing and retainage cannot be released until the closeout requirement is completed. Status: ${getCloseoutReleaseStatus(closeoutFinalBillingState).toLowerCase()}. Next: ${getCloseoutPageNextStep(closeoutFinalBillingState).toLowerCase()}.`}
          </p>
        </div>
        <dl className="workbench-situation-facts closeout-situation-facts">
          {closeoutResolved ? (
            <>
              <div>
                <dt>Result</dt>
                <dd>{closeoutAmount} unblocked for final billing and retainage processing</dd>
              </div>
              <div>
                <dt>Closeout requirement</dt>
                <dd>Completed</dd>
              </div>
              <div>
                <dt>Acceptance / evidence</dt>
                <dd>{completedCloseoutEvidenceCount} of {requiredCloseoutEvidence.length} required items complete</dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>Release approval recorded</dd>
              </div>
              <div>
                <dt>Current status</dt>
                <dd>{getCloseoutReleaseStatus(closeoutFinalBillingState)}</dd>
              </div>
              <div>
                <dt>Command Center</dt>
                <dd>Updated</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Final billing / retainage at risk</dt>
                <dd>{closeoutAmount}</dd>
              </div>
              <div>
                <dt>Blocker reason</dt>
                <dd>{closeoutFinalBillingState.blocker.requirementSummary}</dd>
              </div>
              <div>
                <dt>Current status</dt>
                <dd>{getCloseoutReleaseStatus(closeoutFinalBillingState)}</dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>{getCloseoutPageNextStep(closeoutFinalBillingState)}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <section className="active-workflow-mode" aria-label="Closeout active workflow mode">
        <CloseoutFinalBillingWorkflowClient initialState={closeoutFinalBillingState} />
      </section>

      <CollapsedDetails
        title={closeoutResolved ? "Supporting closeout records" : "Supporting closeout details"}
        summary={closeoutResolved ? "Acceptance records, evidence references, approval history, final billing projection, retainage, archive details, and audit history." : "Packages, missing requirements, acceptance, final billing, retainage, and archive details."}
      >
        {closeoutResolved ? (
          <section className="pipeline-guardrail">
            <strong>Resolved closeout package:</strong>
            <span>
              {closeoutFinalBillingState.blocker.closeoutPackageNumber} approved; {completedCloseoutEvidenceCount} of {requiredCloseoutEvidence.length} required evidence items complete. Payment has not yet been recorded.
            </span>
          </section>
        ) : null}

        {closeoutResolved ? (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Approval and history</p>
                <h2>Final billing release record</h2>
              </div>
            </div>
            <ul className="plain-list">
              <li>Decision note: {closeoutFinalBillingState.blocker.review?.decisionNote ?? "No decision note recorded"}</li>
              <li>Resolution note: {closeoutFinalBillingState.blocker.resolutionNote ?? "No resolution note recorded"}</li>
              <li>Billing projection: {closeoutFinalBillingState.blocker.billingProjection.message}</li>
              <li>Updates recorded: {closeoutFinalBillingState.blocker.history.length}</li>
            </ul>
          </section>
        ) : null}

        <section className="pipeline-guardrail">
          <strong>D5 closeout discipline:</strong>
          <span>As-builts, tests, photos, punch, safety/quality records, RFI/change closure, final billing, waivers, retainage, and acceptance must align before archive.</span>
        </section>

        <WorkflowModuleContext
          queueTitle="D5 acceptance workflow actions"
          workflowType="closeout_acceptance"
        />

        <section className="metrics-grid detail-metrics-grid" aria-label="Closeout summary">
          <PipelineSummaryMetric detail="Active acceptance packages" label="Projects in Closeout" value={pageCloseoutPackages.length} />
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
            packages={pageCloseoutPackages}
            requirements={pageCloseoutRequirements}
            acceptanceRecords={pageAcceptanceRecords}
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
            payApplications={pagePayApplications}
            lienWaivers={pageLienWaivers}
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

function getCloseoutReleaseStatus(state: Awaited<ReturnType<typeof getCloseoutFinalBillingActionState>>) {
  if (state.blocker.state === "resolved") return "Ready for final billing processing";
  if (state.readiness.approvedForRelease) return "Approved for release";
  if (state.blocker.state === "review_pending") return "Under review";
  if (state.readiness.readyForReview) return "Ready for review";
  if (state.readiness.evidenceComplete) return "Evidence complete";
  if (state.readiness.assessmentComplete) return "Assessment saved";
  return "Assessment needed";
}

function getCloseoutPageNextStep(state: Awaited<ReturnType<typeof getCloseoutFinalBillingActionState>>) {
  if (state.blocker.state === "resolved") return "Continue final billing processing";
  if (!state.readiness.assessmentComplete) return "Assess release requirements";
  if (!state.readiness.evidenceComplete) return "Add closeout evidence";
  if (!state.readiness.readyForReview) return "Validate release readiness";
  if (state.blocker.state === "ready_for_review") return "Submit for review";
  if (state.blocker.state === "review_pending") return "Record approval";
  if (!state.readiness.resolutionReady) return "Add resolution note";
  return "Clear the blocker";
}
