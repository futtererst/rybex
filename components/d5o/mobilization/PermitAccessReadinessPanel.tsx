import { artifactLabels } from "@/lib/d5o/presentation";
import type { MobilizationPlan } from "@/lib/d5o/types";

export function PermitAccessReadinessPanel({ plan }: { plan: MobilizationPlan }) {
  return (
    <section className="control-list">
      <h3>Access, Permits, Locates</h3>
      <ul className="compact-list">
        {plan.permitAccessPlan.map((item) => (
          <li key={item.id}>
            <span className={`artifact-state artifact-${item.status}`} />
            <span>
              <strong>{item.name}</strong>
              <small className="muted">
                {item.type} | {artifactLabels[item.status]} | owner {item.owner}
              </small>
            </span>
          </li>
        ))}
        <li>
          <span className={`artifact-state artifact-${plan.utilityLocateStatus.status}`} />
          <span>
            <strong>Utility locates</strong>
            <small className="muted">{artifactLabels[plan.utilityLocateStatus.status]} | {plan.utilityLocateStatus.notes}</small>
          </span>
        </li>
        <li>
          <span className={`artifact-state artifact-${plan.trafficControlStatus.status}`} />
          <span>
            <strong>Traffic control</strong>
            <small className="muted">{artifactLabels[plan.trafficControlStatus.status]} | {plan.trafficControlStatus.notes}</small>
          </span>
        </li>
      </ul>
    </section>
  );
}
