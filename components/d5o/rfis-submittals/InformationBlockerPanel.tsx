import { dateLabel } from "@/lib/d5o/presentation";
import type { RFI, Submittal } from "@/lib/d5o/types";

export function InformationBlockerPanel({
  rfis,
  submittals
}: {
  rfis: RFI[];
  submittals: Submittal[];
}) {
  const blockingRfis = rfis.filter((rfi) => rfi.scheduleImpact || rfi.status === "overdue");
  const blockingSubmittals = submittals.filter(
    (submittal) =>
      submittal.linkedWorkPackageIds.length > 0 &&
      !["approved", "approved_as_noted", "closed"].includes(submittal.status)
  );

  return (
    <section className="control-list">
      <h3>Information Blockers</h3>
      {[...blockingRfis, ...blockingSubmittals].length > 0 ? (
        <ul className="compact-list">
          {blockingRfis.map((rfi) => (
            <li key={rfi.id}>
              <span className="artifact-state artifact-missing" />
              <span>
                <strong>{rfi.title}</strong>
                <small className="muted">{rfi.projectName} | due {dateLabel(rfi.dueDate)}</small>
                <p>{rfi.businessImpact}</p>
              </span>
            </li>
          ))}
          {blockingSubmittals.map((submittal) => (
            <li key={submittal.id}>
              <span className="artifact-state artifact-pending" />
              <span>
                <strong>{submittal.title}</strong>
                <small className="muted">{submittal.projectName} | required {dateLabel(submittal.requiredDate)}</small>
                <p>{submittal.businessImpact}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No schedule-critical information blockers are open.</p>
      )}
    </section>
  );
}
