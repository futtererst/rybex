import Link from "next/link";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { D4ControlScoreCard } from "@/components/d5o/field-execution/D4ControlScoreCard";
import { FieldExecutionDashboard } from "@/components/d5o/field-execution/FieldExecutionDashboard";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { evaluateD4Gate } from "@/lib/d5o/d4-gate";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { billingBackupItems, dailyReports, mobilizationPlans, projects, scheduleOfValues, workPackages } from "@/lib/d5o/seed-data";
import type { RybexProject } from "@/lib/d5o/types";

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

export default function FieldExecutionPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context="D4 captures proof, protects change recovery, supports billing, and builds closeout evidence as work is performed."
        eyebrow="D4 Deliver"
        primaryAction={{ href: "/field-execution/daily-report/new", label: "New Daily Report", tone: "primary" }}
        secondaryActions={[{ href: "/command-center", label: "Command Center" }]}
        subtitle="Control daily field work, production, safety, quality, and issue escalation."
        tags={["Daily field control"]}
        title="Field Execution"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("field-execution")} />

      <CollapsedDetails
        title="Field execution records"
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
              reports={dailyReports.filter((report) => report.projectId === project.id)}
              workPackages={workPackages.filter((workPackage) => workPackage.projectId === project.id)}
            />
          ))}
        </div>
      </section>

      <FieldExecutionDashboard reports={dailyReports} workPackages={workPackages} />

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
            <CloseoutSignal project={project} key={project.id} />
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

function CloseoutSignal({ project }: { project: RybexProject }) {
  const projectReports = dailyReports.filter((report) => report.projectId === project.id);
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
