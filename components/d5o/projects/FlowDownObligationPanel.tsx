import { artifactLabels } from "@/lib/d5o/presentation";
import type { FlowDownObligation } from "@/lib/d5o/types";

export function FlowDownObligationPanel({
  obligations
}: {
  obligations: FlowDownObligation[];
}) {
  if (obligations.length === 0) {
    return <p className="muted">No flow-down obligations have been logged.</p>;
  }

  return (
    <section className="control-list">
      <h3>Flow-Down Obligations</h3>
      <ul className="compact-list">
        {obligations.map((obligation) => (
          <li key={obligation.id}>
            <span className={`artifact-state artifact-${obligation.status}`} />
            <span>
              <strong>{obligation.title}</strong>
              <small className="muted">
                {artifactLabels[obligation.status]} | owner {obligation.owner}
              </small>
              <p>{obligation.businessImpact}</p>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
