import Link from "next/link";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { DailyReport } from "@/lib/d5o/types";

export function DelayChangePromptPanel({ reports }: { reports: DailyReport[] }) {
  const prompts = reports.flatMap((report) =>
    report.changedConditions.map((condition) => ({
      ...condition,
      projectName: report.projectName,
      workPackageName: report.workPackageName,
      reportDate: report.reportDate
    }))
  );
  const delays = reports.flatMap((report) =>
    report.delays.map((delay) => ({ ...delay, projectName: report.projectName }))
  );

  return (
    <section className="control-list">
      <h3>Delay and Change Prompts</h3>
      {prompts.length > 0 ? (
        <ul className="compact-list">
          {prompts.map((prompt) => (
            <li key={prompt.id}>
              <span className="artifact-state artifact-pending" />
              <span>
                <strong>{prompt.description}</strong>
                <small className="muted">
                  {prompt.projectName} | {prompt.workPackageName} | {dateLabel(prompt.reportDate)}
                </small>
                <p>
                  <span className={chipClass(prompt.changeEventNeeded ? "critical" : "warning")}>
                    {prompt.changeEventNeeded ? "Change event needed" : "RFI needed"}
                  </span>{" "}
                  {prompt.noticeDeadline ? `Notice by ${dateLabel(prompt.noticeDeadline)}.` : "Notice deadline not set."}
                </p>
                <p>
                  {prompt.rfiNeeded && <Link href="/rfis-submittals/rfi/new">Create RFI</Link>}
                  {prompt.rfiNeeded && prompt.changeEventNeeded ? " | " : ""}
                  {prompt.changeEventNeeded && <Link href="/changes/new">Create change event</Link>}
                </p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No changed-condition prompts are open.</p>
      )}
      {delays.length > 0 && (
        <p className="missing-callout">
          {delays.length} delay records need schedule, cost, and entitlement review.
        </p>
      )}
    </section>
  );
}
