import {
  dailyReportStatusLabels,
  dailyReportStatusTone,
  productionStatusLabels,
  productionStatusTone
} from "@/lib/d5o/field-execution-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { DailyReport } from "@/lib/d5o/types";

export function DailyReportCard({ report }: { report: DailyReport }) {
  const laborHours = report.laborHours.reduce(
    (total, entry) => total + entry.regularHours + entry.overtimeHours,
    0
  );
  const blockerCount = report.blockers.length + report.delays.length;

  return (
    <article className="opportunity-card" id={report.id}>
      <div className="opportunity-card-top">
        <div>
          <h3>{report.workPackageName}</h3>
          <p className="muted">
            {report.projectName} | {dateLabel(report.reportDate)}
          </p>
        </div>
        <span className={chipClass(dailyReportStatusTone[report.reportStatus])}>
          {dailyReportStatusLabels[report.reportStatus]}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail">
          <span>Supervisor</span>
          <strong>{report.supervisor}</strong>
        </div>
        <div className="detail">
          <span>Labor hours</span>
          <strong>{laborHours}</strong>
        </div>
        <div className="detail">
          <span>Production</span>
          <strong className={chipClass(productionStatusTone[report.productionStatus])}>
            {productionStatusLabels[report.productionStatus]}
          </strong>
        </div>
        <div className="detail">
          <span>Signoff</span>
          <strong>{report.supervisorSignoff.status.replace("_", " ")}</strong>
        </div>
      </div>
      <p className="muted">{report.workPerformed}</p>
      <div className="opportunity-score-row">
        <span className={chipClass(report.changeEventNeeded ? "critical" : report.rfiNeeded ? "warning" : "success")}>
          {report.changeEventNeeded ? "Change prompt" : report.rfiNeeded ? "RFI prompt" : "No commercial prompt"}
        </span>
        <strong>{blockerCount} blockers/delays</strong>
      </div>
    </article>
  );
}
