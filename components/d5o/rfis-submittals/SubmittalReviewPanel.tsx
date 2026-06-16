import { dateLabel } from "@/lib/d5o/presentation";
import type { Submittal } from "@/lib/d5o/types";

export function SubmittalReviewPanel({ submittals }: { submittals: Submittal[] }) {
  const reviewItems = submittals.filter((submittal) =>
    ["submitted", "under_review", "revise_and_resubmit", "rejected", "overdue"].includes(submittal.status)
  );

  return (
    <section className="control-list">
      <h3>Submittal Review Queue</h3>
      {reviewItems.length > 0 ? (
        <ul className="compact-list">
          {reviewItems.map((submittal) => (
            <li key={submittal.id}>
              <span className="artifact-state artifact-pending" />
              <span>
                <strong>{submittal.submittalNumber}: {submittal.title}</strong>
                <small className="muted">{submittal.reviewer} | review due {dateLabel(submittal.reviewDueDate)}</small>
                <p>{submittal.nextAction}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No submittals require review action.</p>
      )}
    </section>
  );
}
