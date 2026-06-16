import { artifactLabels } from "@/lib/d5o/presentation";
import type { MobilizationPlan } from "@/lib/d5o/types";

export function MaterialReadinessPanel({ plan }: { plan: MobilizationPlan }) {
  return (
    <section className="control-list">
      <h3>Materials and Procurement</h3>
      <ul className="compact-list">
        {plan.materialPlan.map((item) => (
          <li key={item.id}>
            <span className={`artifact-state artifact-${item.status}`} />
            <span>
              <strong>{item.name}</strong>
              <small className="muted">
                {artifactLabels[item.status]} | {item.deliveryStatus} | needed {item.neededDate}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
