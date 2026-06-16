import Link from "next/link";
import { chipClass, severityTone } from "@/lib/d5o/presentation";
import type { DailyReport } from "@/lib/d5o/types";

export function FieldSafetyQualityPanel({ reports }: { reports: DailyReport[] }) {
  const safetyItems = reports.flatMap((report) =>
    [...report.safetyObservations, ...report.safetyIncidents].map((item) => ({
      ...item,
      projectName: report.projectName
    }))
  );
  const qualityItems = reports.flatMap((report) =>
    [...report.qualityChecks, ...report.qualityDeficiencies].map((item) => ({
      ...item,
      projectName: report.projectName
    }))
  );

  return (
    <section className="control-list">
      <div className="section-heading compact-heading">
        <h3>Safety / Quality Field Signals</h3>
        <span>
          <Link href="/safety">Safety</Link> / <Link href="/quality">Quality</Link>
        </span>
      </div>
      <div className="score-detail-grid">
        <div>
          <h4>Safety</h4>
          {safetyItems.length > 0 ? (
            <ul className="plain-list">
              {safetyItems.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <span className={chipClass(severityTone[item.severity])}>{item.severity}</span>{" "}
                  {item.description} | {item.projectName} | {item.status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No safety observations captured.</p>
          )}
        </div>
        <div>
          <h4>Quality</h4>
          {qualityItems.length > 0 ? (
            <ul className="plain-list">
              {qualityItems.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <span className={chipClass(item.status === "passed" ? "success" : "critical")}>{item.status}</span>{" "}
                  {item.check} | {item.projectName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No quality checks captured.</p>
          )}
        </div>
      </div>
    </section>
  );
}
