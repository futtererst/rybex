import { dateLabel } from "@/lib/d5o/presentation";
import type { DailyReport } from "@/lib/d5o/types";

export function SupervisorSignoffQueue({ reports }: { reports: DailyReport[] }) {
  const pending = reports.filter((report) => report.supervisorSignoff.status !== "signed");

  return (
    <section className="control-list">
      <h3>Supervisor Signoff Queue</h3>
      {pending.length > 0 ? (
        <ul className="compact-list">
          {pending.map((report) => (
            <li key={report.id}>
              <span className="artifact-state artifact-pending" />
              <span>
                <strong>{report.workPackageName}</strong>
                <small className="muted">
                  {report.projectName} | {dateLabel(report.reportDate)} | {report.supervisor}
                </small>
                <p>{report.supervisorSignoff.notes}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">All current daily reports have supervisor signoff.</p>
      )}
    </section>
  );
}
