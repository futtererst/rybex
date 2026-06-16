import Link from "next/link";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { ContractSummaryCard } from "@/components/d5o/projects/ContractSummaryCard";
import { D2GateReadinessCard } from "@/components/d5o/projects/D2GateReadinessCard";
import { FlowDownObligationPanel } from "@/components/d5o/projects/FlowDownObligationPanel";
import { ProjectBaselineCard } from "@/components/d5o/projects/ProjectBaselineCard";
import { ProjectLaunchDecisionPanel } from "@/components/d5o/projects/ProjectLaunchDecisionPanel";
import { ProjectListTable } from "@/components/d5o/projects/ProjectListTable";
import { ScopeMatrixPanel } from "@/components/d5o/projects/ScopeMatrixPanel";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { D5OPhaseSummary } from "@/components/d5o/D5OPhaseSummary";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { d5oPhases } from "@/lib/d5o/config";
import { evaluateD2Gate } from "@/lib/d5o/d2-gate";
import { evaluateD4Gate } from "@/lib/d5o/d4-gate";
import { evaluateD3Gate } from "@/lib/d5o/d3-gate";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { activePipelineStatuses } from "@/lib/d5o/opportunity-config";
import { contractStatusLabels } from "@/lib/d5o/project-config";
import { compactCurrency, currency, dateLabel } from "@/lib/d5o/presentation";
import {
  changeEvents,
  commercialExposureItems,
  closeoutPackages,
  dailyReports,
  lessonsLearned,
  payApplications,
  mobilizationPlans,
  opportunities,
  punchItems,
  projects,
  qualityDeficiencies,
  rfis,
  safetyRecords,
  submittals,
  testRecords,
  workPackages
} from "@/lib/d5o/seed-data";
import type { D5OPhaseId } from "@/lib/d5o/types";

const d2Projects = projects.filter((project) => project.d5oPhase === "define");
const activeProjects = projects.filter((project) => project.healthStatus !== "closed");
const missingContractBaseline = projects.filter(
  (project) => !["approved", "executed"].includes(project.contractStatus)
);
const blockedFromMobilization = projects.filter(
  (project) => !evaluateD2Gate(project).readyBoolean && project.d5oPhase === "define"
);
const totalContractValue = activeProjects.reduce((total, project) => total + project.contractValue, 0);
const openCommercialRisks = activeProjects.reduce(
  (total, project) => total + project.risks.length,
  0
);
const setupCandidates = opportunities.filter(
  (opportunity) =>
    activePipelineStatuses.includes(opportunity.status) &&
    (opportunity.status === "approved_to_bid" ||
      opportunity.status === "estimating" ||
      opportunity.status === "won" ||
      opportunity.decision === "approve_to_bid")
);
const d3BlockedProjectIds = new Set(
  mobilizationPlans
    .filter((plan) => {
      const project = projects.find((candidate) => candidate.id === plan.projectId);
      return !evaluateD3Gate(plan, project).readyBoolean;
    })
    .map((plan) => plan.projectId)
);
const d4ExceptionProjectIds = new Set(
  projects
    .filter((project) => {
      const projectReports = dailyReports.filter((report) => report.projectId === project.id);

      return projectReports.length > 0 && !evaluateD4Gate({
        reports: projectReports,
        workPackages: workPackages.filter((workPackage) => workPackage.projectId === project.id),
        mobilizationPlan: mobilizationPlans.find((plan) => plan.projectId === project.id),
        project
      }).readyForCloseoutReviewBoolean;
    })
    .map((project) => project.id)
);
const openRfiCount = rfis.filter((rfi) => !["closed", "void"].includes(rfi.status)).length;
const openSubmittalCount = submittals.filter((submittal) =>
  !["approved", "approved_as_noted", "closed"].includes(submittal.status)
).length;
const openChangeExposure = changeEvents
  .filter((change) => !["billed", "closed"].includes(change.status))
  .reduce((total, change) => total + change.costImpactEstimate, 0);
const retainageHeld = payApplications.reduce((total, payApp) => total + payApp.totalRetainageHeld, 0);
const billingCashExposure = commercialExposureItems
  .filter((item) => !["recovered", "written_off"].includes(item.status))
  .reduce((total, item) => total + item.estimatedValue, 0);
const openSafetyControls = safetyRecords.filter((record) => !["closed", "verified"].includes(record.status)).length;
const openQualityControls =
  qualityDeficiencies.filter((item) => !["closed", "verified"].includes(item.status)).length +
  punchItems.filter((item) => !["closed", "verified"].includes(item.status)).length +
  testRecords.filter((item) => item.requiredForCloseout && (item.attachments.length === 0 || ["failed", "overdue", "blocked"].includes(item.status))).length;
const d5BlockedProjects = closeoutPackages.filter((item) => item.status === "missing_requirements" || item.blockers.length > 0).length;
const optimizeReviewsOpen = projects.filter((project) =>
  lessonsLearned.some((lesson) => lesson.projectId === project.id && !["implemented", "verified", "closed"].includes(lesson.status))
).length;

export const metadata = {
  title: "Projects | RybexOS"
};

export default function ProjectsPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context="D2 controls scope, contract, budget, schedule, payment, notice, and handoff risk."
        eyebrow="D2 Define"
        primaryAction={{ href: "/projects/new", label: "New Project Setup", tone: "primary" }}
        secondaryActions={[{ href: "/command-center", label: "Command Center" }]}
        subtitle="Convert awarded work into controlled project baselines before mobilization."
        tags={["Contract baseline"]}
        title="Projects"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("projects")} />

      <CollapsedDetails
        title="Project setup details"
        summary="Project register, phase lanes, D2 gate exceptions, and baseline records."
      >
      <section className="pipeline-guardrail">
        <strong>D2 launch discipline:</strong>
        <span>
          Mobilization planning should not start until contract terms, scope matrix,
          budget baseline, schedule baseline, required registers, and D3 handoff owners are controlled.
        </span>
      </section>

      <WorkflowModuleContext
        queueTitle="D2 contract-baseline workflow actions"
        workflowType="contract_baseline"
      />

      <section className="metrics-grid" aria-label="Project setup summary">
        <PipelineSummaryMetric detail="Non-closed project records" label="Active Projects" value={activeProjects.length} />
        <PipelineSummaryMetric detail="Currently in D2 Define" label="D2 Define" value={d2Projects.length} />
        <PipelineSummaryMetric detail="Contract summary not approved/executed" label="Missing Contract Baseline" tone="warning" value={missingContractBaseline.length} />
        <PipelineSummaryMetric detail="D2 blockers before D3" label="Blocked From Mobilization" tone="critical" value={blockedFromMobilization.length} />
        <PipelineSummaryMetric detail="Active contract value" label="Contract Value" value={compactCurrency.format(totalContractValue)} />
        <PipelineSummaryMetric detail="Open launch/commercial risks" label="Commercial Risks" tone={openCommercialRisks > 0 ? "warning" : "success"} value={openCommercialRisks} />
        <PipelineSummaryMetric detail="Mobilization blockers after D2" label="D3 Blocked" tone={d3BlockedProjectIds.size > 0 ? "critical" : "success"} value={d3BlockedProjectIds.size} />
        <PipelineSummaryMetric detail="Field execution control exceptions" label="D4 Exceptions" tone={d4ExceptionProjectIds.size > 0 ? "warning" : "success"} value={d4ExceptionProjectIds.size} />
        <PipelineSummaryMetric detail="Open project clarifications" label="Open RFIs" tone={openRfiCount > 0 ? "warning" : "success"} value={openRfiCount} />
        <PipelineSummaryMetric detail="Open approval packages" label="Open Submittals" tone={openSubmittalCount > 0 ? "warning" : "success"} value={openSubmittalCount} />
        <PipelineSummaryMetric detail="Estimated open change exposure" label="Change Exposure" tone={openChangeExposure > 0 ? "critical" : "success"} value={compactCurrency.format(openChangeExposure)} />
        <PipelineSummaryMetric detail="Retainage held across pay apps" label="Retainage Held" tone={retainageHeld > 0 ? "warning" : "success"} value={compactCurrency.format(retainageHeld)} />
        <PipelineSummaryMetric detail="Billing and recovery exposure" label="Cash Exposure" tone={billingCashExposure > 0 ? "critical" : "success"} value={compactCurrency.format(billingCashExposure)} />
        <PipelineSummaryMetric detail="Open safety controls" label="Safety Controls" tone={openSafetyControls > 0 ? "warning" : "success"} value={openSafetyControls} />
        <PipelineSummaryMetric detail="Deficiencies, tests, and punch risk" label="Quality Controls" tone={openQualityControls > 0 ? "critical" : "success"} value={openQualityControls} />
        <PipelineSummaryMetric detail="Packages blocked or missing evidence" label="D5 Closeout" tone={d5BlockedProjects > 0 ? "critical" : "success"} value={d5BlockedProjects} />
        <PipelineSummaryMetric detail="Projects with open lessons learned" label="Optimize Reviews" tone={optimizeReviewsOpen > 0 ? "warning" : "success"} value={optimizeReviewsOpen} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project Control List</p>
            <h2>Contract baseline and launch status</h2>
          </div>
          <span className="muted">D2 gate readiness, contract posture, and next action</span>
        </div>
        <ProjectListTable projects={projects} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">D5O Project Flow</p>
            <h2>Projects grouped by operating phase</h2>
          </div>
        </div>
        <div className="phase-lane-grid">
          {d5oPhases.map((phase) => (
            <D5OPhaseSummary
              key={phase.id}
              phaseId={phase.id as D5OPhaseId}
              projects={projects.filter((project) => project.d5oPhase === phase.id)}
            />
          ))}
        </div>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">D2 Gate Exceptions</p>
              <h2>Projects not ready for D3</h2>
            </div>
            <span className="muted">{blockedFromMobilization.length} blocked or held</span>
          </div>
          <div className="project-stack">
            {blockedFromMobilization.map((project) => (
              <article className="opportunity-detail-panel" id={project.id} key={project.id}>
                <div className="status-row">
                  <div>
                    <h3>{project.name}</h3>
                    <p className="muted">
                      {project.gcClient} | {contractStatusLabels[project.contractStatus]} | {currency.format(project.contractValue)}
                    </p>
                  </div>
                </div>
                <D2GateReadinessCard compact project={project} />
                <ProjectLaunchDecisionPanel decision={evaluateD2Gate(project).recommendedDecision} nextAction={project.nextAction} />
              </article>
            ))}
          </div>
        </section>

        <aside className="panel">
          <p className="eyebrow">Recently Awarded</p>
          <h2>Ready for setup</h2>
          <ul className="compact-list">
            {setupCandidates.map((opportunity) => (
              <li key={opportunity.id}>
                <span className="artifact-state artifact-complete" />
                <span>
                  <strong>{opportunity.name}</strong>
                  <small className="muted">
                    {opportunity.gcClient} | bid due {dateLabel(opportunity.bidDueDate)}
                  </small>
                  <p>
                    Approved pursuit can be converted into D2 setup.{" "}
                    <Link href="/projects/new">Start setup</Link>
                  </p>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Baseline Detail</p>
            <h2>Contract, scope, budget, schedule, and flow-down controls</h2>
          </div>
        </div>
        <div className="project-detail-grid">
          {projects.slice(0, 5).map((project) => (
            <article className="project-detail-card" key={project.id}>
              <h3>{project.name}</h3>
              <ContractSummaryCard project={project} />
              <ProjectBaselineCard project={project} />
              {evaluateD2Gate(project).readyBoolean && (
                <p className="ready-callout">
                  D2 baseline ready. <Link href="/mobilization/new">Start mobilization planning.</Link>
                </p>
              )}
              {dailyReports.some((report) => report.projectId === project.id) && (
                <p className={d4ExceptionProjectIds.has(project.id) ? "missing-callout" : "ready-callout"}>
                  D4 field records active. <Link href="/field-execution">Review field execution control.</Link>
                </p>
              )}
              {(rfis.some((rfi) => rfi.projectId === project.id && !["closed", "void"].includes(rfi.status)) ||
                changeEvents.some((change) => change.projectId === project.id && !["billed", "closed"].includes(change.status))) && (
                <p className="missing-callout">
                  Project controls active: {rfis.filter((rfi) => rfi.projectId === project.id && !["closed", "void"].includes(rfi.status)).length} open RFI(s),{" "}
                  {submittals.filter((submittal) => submittal.projectId === project.id && !["approved", "approved_as_noted", "closed"].includes(submittal.status)).length} open submittal(s),{" "}
                  {changeEvents.filter((change) => change.projectId === project.id && !["billed", "closed"].includes(change.status)).length} open change(s).{" "}
                  <Link href="/rfis-submittals">Review controls.</Link>
                </p>
              )}
              {payApplications.some((payApp) => payApp.projectId === project.id) && (
                <p className="ready-callout">
                  Billing active: {payApplications.filter((payApp) => payApp.projectId === project.id).length} pay app(s),{" "}
                  {compactCurrency.format(payApplications.filter((payApp) => payApp.projectId === project.id).reduce((total, payApp) => total + payApp.totalRetainageHeld, 0))} retainage held.{" "}
                  <Link href="/billing">Review billing readiness.</Link>
                </p>
              )}
              <ScopeMatrixPanel items={project.scopeMatrix} />
              <FlowDownObligationPanel obligations={project.flowDownObligations} />
            </article>
          ))}
        </div>
      </section>
      </CollapsedDetails>
    </div>
  );
}
