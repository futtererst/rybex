import Link from "next/link";
import {
  productionStatusLabels,
  productionStatusTone
} from "@/lib/d5o/field-execution-config";
import { workPackageStatusLabels, workPackageStatusTone } from "@/lib/d5o/mobilization-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { DailyReport, WorkPackage } from "@/lib/d5o/types";

export function WorkPackageExecutionCard({
  workPackage,
  reports
}: {
  workPackage: WorkPackage;
  reports: DailyReport[];
}) {
  const latestReport = [...reports].sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
  const installed = reports.flatMap((report) => report.installedQuantities);

  return (
    <article className="opportunity-card" id={workPackage.id}>
      <div className="opportunity-card-top">
        <div>
          <h3>{workPackage.name}</h3>
          <p className="muted">
            {workPackage.location} | {dateLabel(workPackage.plannedStartDate)} to {dateLabel(workPackage.plannedFinishDate)}
          </p>
        </div>
        <span className={chipClass(workPackageStatusTone[workPackage.status])}>
          {workPackageStatusLabels[workPackage.status]}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail">
          <span>Crew</span>
          <strong>{workPackage.assignedCrew}</strong>
        </div>
        <div className="detail">
          <span>Supervisor</span>
          <strong>{workPackage.fieldSupervisor}</strong>
        </div>
        <div className="detail">
          <span>Reports</span>
          <strong>{reports.length}</strong>
        </div>
        <div className="detail">
          <span>Production</span>
          <strong className={chipClass(productionStatusTone[latestReport?.productionStatus ?? "not_started"])}>
            {productionStatusLabels[latestReport?.productionStatus ?? "not_started"]}
          </strong>
        </div>
      </div>
      <p className="muted">{workPackage.scopeDescription}</p>
      {installed.length > 0 ? (
        <ul className="plain-list">
          {installed.slice(0, 3).map((quantity) => (
            <li key={quantity.id}>
              {quantity.description}: {quantity.quantity} {quantity.unit} of {quantity.productionTarget} target
            </li>
          ))}
        </ul>
      ) : (
        <p className="missing-callout">No installed quantities recorded yet.</p>
      )}
      <div className="card-row">
        <span className="muted">{workPackage.nextAction}</span>
        <Link className="button button-secondary" href="/field-execution/daily-report/new">
          Daily Report
        </Link>
      </div>
    </article>
  );
}
