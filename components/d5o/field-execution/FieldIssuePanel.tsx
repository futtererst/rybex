import { severityTone, chipClass } from "@/lib/d5o/presentation";
import type { DailyReport } from "@/lib/d5o/types";

export function FieldIssuePanel({ reports }: { reports: DailyReport[] }) {
  const blockers = reports.flatMap((report) =>
    report.blockers.map((blocker) => ({ ...blocker, projectName: report.projectName }))
  );

  return (
    <section className="control-list">
      <h3>Field Issues and Blockers</h3>
      {blockers.length > 0 ? (
        <ul className="compact-list">
          {blockers.map((blocker) => (
            <li key={blocker.id}>
              <span className="artifact-state artifact-missing" />
              <span>
                <strong>{blocker.title}</strong>
                <small className="muted">
                  {blocker.projectName} | owner {blocker.owner}
                </small>
                <p>
                  <span className={chipClass(severityTone[blocker.severity])}>{blocker.severity}</span>{" "}
                  {blocker.businessImpact}
                </p>
                <p>{blocker.requiredAction}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No active field blockers in the current reports.</p>
      )}
    </section>
  );
}
