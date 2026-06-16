import {
  dailyReportStatusLabels,
  dailyReportStatusTone
} from "@/lib/d5o/field-execution-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { DailyReport } from "@/lib/d5o/types";

export function DailyReportCompliancePanel({ reports }: { reports: DailyReport[] }) {
  const exceptions = reports.filter((report) =>
    ["missing", "late", "draft", "rejected"].includes(report.reportStatus)
  );

  return (
    <section className="control-list">
      <h3>Daily Report Compliance</h3>
      {exceptions.length > 0 ? (
        <ul className="compact-list">
          {exceptions.map((report) => (
            <li key={report.id}>
              <span className="artifact-state artifact-missing" />
              <span>
                <strong>{report.projectName}</strong>
                <small className="muted">
                  {report.workPackageName} | {dateLabel(report.reportDate)} | {report.supervisor}
                </small>
                <p>
                  <span className={chipClass(dailyReportStatusTone[report.reportStatus])}>
                    {dailyReportStatusLabels[report.reportStatus]}
                  </span>{" "}
                  {report.nextDayPlan}
                </p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">All active daily reports are submitted or approved.</p>
      )}
    </section>
  );
}
