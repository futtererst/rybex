import Link from "next/link";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { CrewEquipmentReadinessPanel } from "@/components/d5o/mobilization/CrewEquipmentReadinessPanel";
import { D3GateReadinessCard } from "@/components/d5o/mobilization/D3GateReadinessCard";
import { MaterialReadinessPanel } from "@/components/d5o/mobilization/MaterialReadinessPanel";
import { MobilizationDecisionPanel } from "@/components/d5o/mobilization/MobilizationDecisionPanel";
import { MobilizationReadinessCard } from "@/components/d5o/mobilization/MobilizationReadinessCard";
import { MobilizationTable } from "@/components/d5o/mobilization/MobilizationTable";
import { PermitAccessReadinessPanel } from "@/components/d5o/mobilization/PermitAccessReadinessPanel";
import { QualityWorkPackagePanel } from "@/components/d5o/mobilization/QualityWorkPackagePanel";
import { SafetyReadinessPanel } from "@/components/d5o/mobilization/SafetyReadinessPanel";
import { WorkPackageCard } from "@/components/d5o/mobilization/WorkPackageCard";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { evaluateD2Gate } from "@/lib/d5o/d2-gate";
import { evaluateD3Gate } from "@/lib/d5o/d3-gate";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import {
  mobilizationStatusLabels,
  mobilizationStatusTone
} from "@/lib/d5o/mobilization-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { dailyReports, mobilizationPlans, projects, workPackages } from "@/lib/d5o/seed-data";

const awaitingPlanning = projects.filter((project) => evaluateD2Gate(project).readyBoolean);
const readyForField = mobilizationPlans.filter((plan) => {
  const project = projects.find((candidate) => candidate.id === plan.projectId);
  return evaluateD3Gate(plan, project).readyBoolean;
});
const blockedFromD4 = mobilizationPlans.filter((plan) => {
  const project = projects.find((candidate) => candidate.id === plan.projectId);
  return !evaluateD3Gate(plan, project).readyBoolean;
});
const openBlockers = mobilizationPlans.reduce((total, plan) => total + plan.blockers.length, 0);
const missingSafety = mobilizationPlans.filter(
  (plan) => plan.safetyPlanStatus !== "complete" || plan.jhaStatus !== "complete"
);
const missingAccess = mobilizationPlans.filter(
  (plan) =>
    plan.permitAccessPlan.some((item) => item.status !== "complete" && item.status !== "waived") ||
    (plan.utilityLocateStatus.required && plan.utilityLocateStatus.status !== "complete")
);
const workPackagesNotReady = workPackages.filter(
  (workPackage) =>
    workPackage.status !== "ready_for_field" &&
    workPackage.status !== "in_progress" &&
    workPackage.status !== "complete"
);
const upcomingFieldStarts = [...mobilizationPlans]
  .sort((a, b) => a.plannedFieldStartDate.localeCompare(b.plannedFieldStartDate))
  .slice(0, 5);
const fieldStartedPlans = mobilizationPlans.filter((plan) => plan.readinessStatus === "field_started");

export const metadata = {
  title: "Mobilization | RybexOS"
};

export default function MobilizationPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context="D3 controls crews, equipment, materials, access, permits, locates, safety, quality, and work packages."
        eyebrow="D3 Design / Prepare"
        primaryAction={{ href: "/mobilization/new", label: "New Mobilization Plan", tone: "primary" }}
        secondaryActions={[{ href: "/command-center", label: "Command Center" }]}
        subtitle="Confirm field readiness before work starts."
        tags={["Field-start gate"]}
        title="Mobilization"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("mobilization")} />

      <CollapsedDetails
        title="Mobilization details"
        summary="Readiness matrix, field-start blockers, work packages, and D4 handoff records."
      >
      <section className="pipeline-guardrail">
        <strong>D3 field-start discipline:</strong>
        <span>
          Field execution should not start until safety, access, permits, locates,
          materials, crew, quality controls, kickoff, and work packages are ready.
        </span>
      </section>

      <WorkflowModuleContext
        queueTitle="D3 field-start workflow actions"
        workflowType="mobilization_readiness"
      />

      <section className="metrics-grid" aria-label="Mobilization summary">
        <PipelineSummaryMetric detail="D2-ready projects needing D3 planning" label="Awaiting Planning" value={awaitingPlanning.length} />
        <PipelineSummaryMetric detail="Approved for field start" label="Ready for Field" tone="success" value={readyForField.length} />
        <PipelineSummaryMetric detail="Blocked from D4 delivery" label="Blocked From D4" tone="critical" value={blockedFromD4.length} />
        <PipelineSummaryMetric detail="Open mobilization blockers" label="Open Blockers" tone={openBlockers > 0 ? "critical" : "success"} value={openBlockers} />
        <PipelineSummaryMetric detail="Safety plan or JHA missing" label="Safety Packages" tone={missingSafety.length > 0 ? "warning" : "success"} value={missingSafety.length} />
        <PipelineSummaryMetric detail="Permits, access, or locates missing" label="Access / Locates" tone={missingAccess.length > 0 ? "warning" : "success"} value={missingAccess.length} />
        <PipelineSummaryMetric detail="Work packages not field-ready" label="Work Packages" tone={workPackagesNotReady.length > 0 ? "warning" : "success"} value={workPackagesNotReady.length} />
        <PipelineSummaryMetric detail="Daily field records started" label="D4 Reports" tone={dailyReports.length > 0 ? "info" : "warning"} value={dailyReports.length} />
      </section>

      <section className="pipeline-guardrail">
        <strong>D3 readiness handoff:</strong>
        <span>
          Safety package gaps should be worked in <Link href="/safety">Safety</Link>; quality plan, test, and work-package evidence gaps should be worked in <Link href="/quality">Quality</Link>.
        </span>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Mobilization Control Table</p>
            <h2>Field-start readiness by project</h2>
          </div>
          <span className="muted">D3 readiness, blockers, owner, and next action</span>
        </div>
        <MobilizationTable plans={mobilizationPlans} projects={projects} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Readiness Board</p>
            <h2>Projects grouped by D3 status</h2>
          </div>
        </div>
        <div className="pipeline-board">
          {(["planning", "awaiting_inputs", "blocked", "ready_for_review", "approved_for_field_start", "field_started"] as const).map((status) => {
            const plans = mobilizationPlans.filter((plan) => plan.readinessStatus === status);
            return (
              <section className="pipeline-lane" key={status}>
                <div className="phase-lane-header">
                  <div>
                    <strong>{mobilizationStatusLabels[status]}</strong>
                    <p className="muted">D3 readiness status</p>
                  </div>
                  <span className={chipClass(mobilizationStatusTone[status])}>{plans.length}</span>
                </div>
                <div className="project-stack">
                  {plans.length > 0 ? (
                    plans.map((plan) => (
                      <MobilizationReadinessCard
                        key={plan.id}
                        plan={plan}
                        project={projects.find((project) => project.id === plan.projectId)}
                      />
                    ))
                  ) : (
                    <p className="muted">No mobilizations in this status.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Blocked Mobilizations</p>
              <h2>Do not release to D4</h2>
            </div>
            <span className="muted">{blockedFromD4.length} blocked or held</span>
          </div>
          <div className="project-stack">
            {blockedFromD4.map((plan) => {
              const project = projects.find((candidate) => candidate.id === plan.projectId);
              const readiness = evaluateD3Gate(plan, project);
              return (
                <article className="opportunity-detail-panel" key={plan.id}>
                  <h3>{plan.projectName}</h3>
                  <D3GateReadinessCard compact plan={plan} project={project} />
                  <MobilizationDecisionPanel decision={readiness.recommendedDecision} nextAction={plan.nextAction} />
                </article>
              );
            })}
          </div>
        </section>

        <aside className="panel">
          <p className="eyebrow">Upcoming Field Starts</p>
          <h2>Field start calendar</h2>
          <ul className="deadline-list">
            {upcomingFieldStarts.map((plan) => (
              <li key={plan.id}>
                <div>
                  <strong>{plan.projectName}</strong>
                  <small className="muted">Start {dateLabel(plan.plannedFieldStartDate)} | owner {plan.mobilizationOwner}</small>
                </div>
                <span className={chipClass(mobilizationStatusTone[plan.readinessStatus])}>
                  {mobilizationStatusLabels[plan.readinessStatus]}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Readiness Artifacts</p>
            <h2>Crew, materials, access, safety, quality, and work packages</h2>
          </div>
        </div>
        <div className="project-detail-grid">
          {mobilizationPlans.map((plan) => (
            <article className="project-detail-card" key={plan.id}>
              <h3>{plan.projectName}</h3>
              <CrewEquipmentReadinessPanel plan={plan} />
              <MaterialReadinessPanel plan={plan} />
              <PermitAccessReadinessPanel plan={plan} />
              <SafetyReadinessPanel plan={plan} />
              <QualityWorkPackagePanel plan={plan} />
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Work Packages</p>
            <h2>Field-executable work packages</h2>
          </div>
          <span className="muted">{workPackages.length} work packages</span>
        </div>
        <div className="project-detail-grid">
          {workPackages.map((workPackage) => (
            <WorkPackageCard key={workPackage.id} workPackage={workPackage} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">D4 Handoff</p>
            <h2>Approved work moving into daily field control</h2>
          </div>
          <Link className="button button-secondary" href="/field-execution">
            Field Execution
          </Link>
        </div>
        <div className="operating-columns">
          {fieldStartedPlans.map((plan) => (
            <section className="control-list" key={plan.id}>
              <h3>{plan.projectName}</h3>
              <p className="muted">
                {dailyReports.filter((report) => report.projectId === plan.projectId).length} daily report records are active.
              </p>
              <p className="ready-callout">
                Field started. <Link href="/field-execution/daily-report/new">Create daily report.</Link>
              </p>
            </section>
          ))}
        </div>
      </section>
      </CollapsedDetails>
    </div>
  );
}
