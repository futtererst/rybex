import { DailyReportCard } from "./DailyReportCard";
import { DailyReportCompliancePanel } from "./DailyReportCompliancePanel";
import { DelayChangePromptPanel } from "./DelayChangePromptPanel";
import { FieldIssuePanel } from "./FieldIssuePanel";
import { FieldSafetyQualityPanel } from "./FieldSafetyQualityPanel";
import { ProductionProgressPanel } from "./ProductionProgressPanel";
import { SupervisorSignoffQueue } from "./SupervisorSignoffQueue";
import { WorkPackageExecutionCard } from "./WorkPackageExecutionCard";
import type { DailyReport, WorkPackage } from "@/lib/d5o/types";

export function FieldExecutionDashboard({
  reports,
  workPackages
}: {
  reports: DailyReport[];
  workPackages: WorkPackage[];
}) {
  const activeWorkPackages = workPackages.filter((workPackage) =>
    ["ready_for_field", "in_progress", "blocked"].includes(workPackage.status)
  );

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Today Field Work</p>
            <h2>Active work packages</h2>
          </div>
          <span className="muted">{activeWorkPackages.length} active packages</span>
        </div>
        <div className="project-detail-grid">
          {activeWorkPackages.map((workPackage) => (
            <WorkPackageExecutionCard
              key={workPackage.id}
              reports={reports.filter((report) => report.workPackageId === workPackage.id)}
              workPackage={workPackage}
            />
          ))}
        </div>
      </section>

      <div className="operating-columns">
        <DailyReportCompliancePanel reports={reports} />
        <ProductionProgressPanel reports={reports} />
        <FieldIssuePanel reports={reports} />
        <DelayChangePromptPanel reports={reports} />
        <FieldSafetyQualityPanel reports={reports} />
        <SupervisorSignoffQueue reports={reports} />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent Daily Reports</p>
            <h2>Crew, quantity, safety, quality, and signoff records</h2>
          </div>
          <span className="muted">{reports.length} reports</span>
        </div>
        <div className="project-detail-grid">
          {reports.map((report) => (
            <DailyReportCard key={report.id} report={report} />
          ))}
        </div>
      </section>
    </>
  );
}
