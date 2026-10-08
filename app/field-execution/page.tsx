import Link from "next/link";
import { CollapsedDetails } from "@/components/d5o/end-user";
import { D4ControlScoreCard } from "@/components/d5o/field-execution/D4ControlScoreCard";
import { FieldExecutionDashboard } from "@/components/d5o/field-execution/FieldExecutionDashboard";
import { FieldIssueEscalationWorkflowClient } from "@/components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { evaluateD4Gate } from "@/lib/d5o/d4-gate";
import {
  getFieldIssueActionState,
  getFieldIssueSeedDataOverlay
} from "@/lib/d5o/field-issue-escalation/store";
import { billingBackupItems, dailyReports, mobilizationPlans, projects, scheduleOfValues, workPackages } from "@/lib/d5o/seed-data";
import type { DailyReport, RybexProject } from "@/lib/d5o/types";

const activeFieldReports = dailyReports.filter((report) =>
  ["draft", "submitted", "supervisor_review", "approved", "missing", "late"].includes(report.reportStatus)
);
const activeFieldProjectIds = new Set(activeFieldReports.map((report) => report.projectId));
const activeFieldProjects = projects.filter((project) => activeFieldProjectIds.has(project.id));
const activeWorkPackages = workPackages.filter((workPackage) =>
  ["in_progress", "ready_for_field", "blocked"].includes(workPackage.status)
);
const missingReports = dailyReports.filter((report) =>
  ["missing", "late"].includes(report.reportStatus)
);
const openFieldIssues = dailyReports.flatMap((report) => report.blockers);
const delayEvents = dailyReports.flatMap((report) => report.delays);
const potentialChangeEvents = dailyReports.filter(
  (report) => report.changeEventNeeded || report.changedConditions.some((condition) => condition.changeEventNeeded)
);
const safetySignals = dailyReports.flatMap((report) => [
  ...report.safetyObservations,
  ...report.safetyIncidents
]);
const qualitySignals = dailyReports.flatMap((report) => [
  ...report.qualityChecks.filter((check) => check.status !== "passed"),
  ...report.qualityDeficiencies
]);
const signoffQueue = dailyReports.filter((report) => report.supervisorSignoff.status !== "signed");
const fieldControlProjects = activeFieldProjects.slice(0, 4);
const billingBackupRisk = billingBackupItems.filter((item) =>
  ["daily_report", "quantity_record", "photo", "test_report"].includes(item.type) &&
  ["missing", "partial"].includes(item.status)
);

export const metadata = {
  title: "Field Execution | RybexOS"
};

export const dynamic = "force-dynamic";

export default async function FieldExecutionPage() {
  const fieldIssueState = await getFieldIssueActionState();
  const fieldIssueOverlay = await getFieldIssueSeedDataOverlay();
  const pageDailyReports = fieldIssueOverlay.dailyReports;
  const activeFieldReports = pageDailyReports.filter((report) =>
    ["draft", "submitted", "supervisor_review", "approved", "missing", "late"].includes(report.reportStatus)
  );
  const activeFieldProjectIds = new Set(activeFieldReports.map((report) => report.projectId));
  const activeFieldProjects = projects.filter((project) => activeFieldProjectIds.has(project.id));
  const activeWorkPackages = workPackages.filter((workPackage) =>
    ["in_progress", "ready_for_field", "blocked"].includes(workPackage.status)
  );
  const missingReports = pageDailyReports.filter((report) =>
    ["missing", "late"].includes(report.reportStatus)
  );
  const openFieldIssues = pageDailyReports.flatMap((report) => report.blockers);
  const delayEvents = pageDailyReports.flatMap((report) => report.delays);
  const potentialChangeEvents = pageDailyReports.filter(
    (report) => report.changeEventNeeded || report.changedConditions.some((condition) => condition.changeEventNeeded)
  );
  const safetySignals = pageDailyReports.flatMap((report) => [
    ...report.safetyObservations,
    ...report.safetyIncidents
  ]);
  const qualitySignals = pageDailyReports.flatMap((report) => [
    ...report.qualityChecks.filter((check) => check.status !== "passed"),
    ...report.qualityDeficiencies
  ]);
  const signoffQueue = pageDailyReports.filter((report) => report.supervisorSignoff.status !== "signed");
  const fieldControlProjects = activeFieldProjects.slice(0, 4);
  const billingBackupRisk = billingBackupItems.filter((item) =>
    ["daily_report", "quantity_record", "photo", "test_report"].includes(item.type) &&
    ["missing", "partial"].includes(item.status)
  );
  const fieldIssue = fieldIssueState.issue;
  const fieldIssueResolved = fieldIssue.state === "resolved";
  const fieldIssueNextStep = getFieldIssuePageNextStep(fieldIssue.state);
  const fieldIssueScheduleExposure = fieldIssue.assessment?.scheduleDays ?? (fieldIssue.scheduleImpact ? 2 : 0);
  const fieldIssueCostExposure = fieldIssue.assessment?.costExposure ?? fieldIssue.costExposure;

  return (
    <div className={`command-grid field-execution-page active-workbench-page ${fieldIssueResolved ? "field-execution-page-resolved" : "field-execution-page-unresolved"}`}>
      <PageHeader
        context="Use the active escalation workbench to turn the field issue into the right follow-up path."
        eyebrow="Field Operations"
        subtitle="Turn a field issue into the right RFI or change path before it affects schedule or margin."
        tags={["Field issue"]}
        title="Field Execution"
      />

      <section className="workbench-situation-hero field-situation-hero" data-qa="field-issue-situation-hero">
        <div className="workbench-situation-copy field-situation-copy">
          <p className="eyebrow">Field issue workbench</p>
          <h2>Escalate field issue</h2>
          <p>
            Complete this workflow to turn the field condition into the right RFI or change path before it affects schedule or margin.
          </p>
          <p className="mobile-workbench-summary">
            {fieldIssue.location}. {fieldIssueScheduleExposure}-day exposure · {fieldIssueCostExposure.toLocaleString("en-US", { currency: "USD", style: "currency", maximumFractionDigits: 0 })} at risk. {fieldIssue.summary}. Next: {fieldIssueNextStep.toLowerCase()}
          </p>
        </div>
        <dl className="workbench-situation-facts field-situation-facts">
          <div>
            <dt>Project / location</dt>
            <dd>{fieldIssue.projectName} · {fieldIssue.location}</dd>
          </div>
          <div>
            <dt>Issue summary</dt>
            <dd>{fieldIssue.summary}</dd>
          </div>
          <div>
            <dt>Schedule / commercial impact</dt>
            <dd>{fieldIssueScheduleExposure} day exposure · {fieldIssueCostExposure.toLocaleString("en-US", { currency: "USD", style: "currency", maximumFractionDigits: 0 })} at risk</dd>
          </div>
          <div>
            <dt>Current status</dt>
            <dd>{fieldIssueResolved ? "Original field issue resolved" : fieldIssue.state.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Next step</dt>
            <dd>{fieldIssueNextStep}</dd>
          </div>
        </dl>
      </section>

      <section className="active-workflow-mode" aria-label="Field issue active workflow mode">
        <FieldIssueEscalationWorkflowClient initialState={fieldIssueState} />
      </section>

      <CollapsedDetails
        title="Supporting field details"
        summary="Daily reports, production, field issues, billing support, and closeout evidence signals."
      >
      <section className="pipeline-guardrail">
        <strong>D4 execution discipline:</strong>
        <span>
          Daily reports must capture labor, equipment, quantities, safety, quality,
          photos, delays, changed conditions, and supervisor signoff while the work is happening.
        </span>
      </section>

      <WorkflowModuleContext
        queueTitle="D4 field-execution workflow actions"
        workflowType="field_execution"
      />

      <section className="metrics-grid" aria-label="Field execution summary">
        <PipelineSummaryMetric detail="Projects with D4 field records" label="Active Field Projects" value={activeFieldProjects.length} />
        <PipelineSummaryMetric detail="Ready, active, or blocked packages" label="Work Packages" value={activeWorkPackages.length} />
        <PipelineSummaryMetric detail="Missing or late daily reports" label="Reports Due / Missing" tone={missingReports.length > 0 ? "critical" : "success"} value={missingReports.length} />
        <PipelineSummaryMetric detail="Open blockers from daily reports" label="Field Issues" tone={openFieldIssues.length > 0 ? "critical" : "success"} value={openFieldIssues.length} />
        <PipelineSummaryMetric detail="Delay events captured this week" label="Delay Events" tone={delayEvents.length > 0 ? "warning" : "success"} value={delayEvents.length} />
        <PipelineSummaryMetric detail="RFI/change prompts from field" label="Change Prompts" tone={potentialChangeEvents.length > 0 ? "critical" : "success"} value={potentialChangeEvents.length} />
        <PipelineSummaryMetric detail="Safety observations or incidents" label="Safety Signals" tone={safetySignals.some((item) => item.status !== "closed") ? "warning" : "success"} value={safetySignals.length} />
        <PipelineSummaryMetric detail="Open quality deficiencies" label="Quality Deficiencies" tone={qualitySignals.length > 0 ? "warning" : "success"} value={qualitySignals.length} />
        <PipelineSummaryMetric detail="Field records needed for billing" label="Billing Backup Risk" tone={billingBackupRisk.length > 0 ? "critical" : "success"} value={billingBackupRisk.length} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">D4 Control Queue</p>
            <h2>Can work continue, escalate, or move toward closeout?</h2>
          </div>
          <span className="muted">{signoffQueue.length} reports need supervisor signoff</span>
        </div>
        <div className="project-detail-grid">
          {fieldControlProjects.map((project) => (
            <D4ControlScoreCard
              key={project.id}
              mobilizationPlan={mobilizationPlans.find((plan) => plan.projectId === project.id)}
              project={project}
              reports={pageDailyReports.filter((report) => report.projectId === project.id)}
              workPackages={workPackages.filter((workPackage) => workPackage.projectId === project.id)}
            />
          ))}
        </div>
      </section>

      <FieldExecutionDashboard reports={pageDailyReports} workPackages={workPackages} />

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">D5 Handoff Signals</p>
            <h2>Closeout evidence captured during work</h2>
          </div>
          <Link className="button button-secondary" href="/closeout">Closeout</Link>
        </div>
        <div className="operating-columns">
          {activeFieldProjects.map((project) => (
            <CloseoutSignal project={project} key={project.id} reports={pageDailyReports} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Billing Support</p>
            <h2>Daily reports and installed quantities feeding pay applications</h2>
          </div>
          <Link className="button button-secondary" href="/billing">Billing</Link>
        </div>
        <div className="operating-columns">
          {activeFieldProjects.map((project) => {
            const projectLines = scheduleOfValues.filter((line) => line.projectId === project.id);
            const currentBilling = projectLines.reduce((total, line) => total + line.currentBilled + line.storedMaterials, 0);
            const backupGaps = billingBackupItems.filter((item) => item.projectId === project.id && ["missing", "partial"].includes(item.status));

            return (
              <section className="control-list" key={project.id}>
                <h3>{project.name}</h3>
                <ul className="plain-list">
                  <li>Current field-supported billing: {currentBilling.toLocaleString("en-US", { currency: "USD", style: "currency", maximumFractionDigits: 0 })}</li>
                  <li>{projectLines.length} SOV line(s) linked to daily reports or quantities</li>
                  <li>{backupGaps.length} billing backup gap(s)</li>
                </ul>
                {backupGaps.length > 0 ? <p className="missing-callout">Billing backup needs PM/field attention.</p> : <p className="ready-callout">Field backup is billing-ready.</p>}
              </section>
            );
          })}
        </div>
      </section>

      <section className="pipeline-guardrail">
        <strong>O production intelligence:</strong>
        <span>
          Installed quantities, daily reports, delays, and work package productivity should feed the <Link href="/reports">Optimize</Link> production rate library.
        </span>
      </section>
      </CollapsedDetails>
    </div>
  );
}

function getFieldIssuePageNextStep(state: string) {
  if (state === "unresolved") return "Start the escalation.";
  if (state === "in_progress") return "Save the impact assessment.";
  if (state === "assessed") return "Add an evidence reference.";
  if (state === "evidence_added") return "Choose RFI or Change Event.";
  if (state === "path_selected") return "Create the downstream record.";
  if (state === "downstream_created") return "Clear the original field blocker.";
  if (state === "resolved") return "Track the downstream record.";
  return "Complete the next field issue step.";
}

function CloseoutSignal({ project, reports }: { project: RybexProject; reports: DailyReport[] }) {
  const projectReports = reports.filter((report) => report.projectId === project.id);
  const photoGaps = projectReports.filter((report) => !report.requiredPhotosComplete).length;
  const testGaps = projectReports.filter((report) => !report.requiredTestsComplete).length;
  const punchItems = projectReports.flatMap((report) => report.punchItemsCreated);

  return (
    <section className="control-list">
      <h3>{project.name}</h3>
      <ul className="plain-list">
        <li>{projectReports.length} daily report records</li>
        <li>{photoGaps} photo evidence gaps</li>
        <li>{testGaps} test evidence gaps</li>
        <li>{punchItems.length} punch or correction items</li>
      </ul>
      {photoGaps + testGaps > 0 ? (
        <p className="missing-callout">Evidence must be captured before D5 closeout review.</p>
      ) : (
        <p className="ready-callout">Closeout evidence is being captured as work proceeds.</p>
      )}
    </section>
  );
}
