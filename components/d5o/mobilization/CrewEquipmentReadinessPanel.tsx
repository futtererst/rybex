import { artifactLabels } from "@/lib/d5o/presentation";
import type { MobilizationPlan } from "@/lib/d5o/types";

export function CrewEquipmentReadinessPanel({ plan }: { plan: MobilizationPlan }) {
  return (
    <section className="control-list">
      <h3>Crew and Equipment</h3>
      <ul className="compact-list">
        <li>
          <span className={`artifact-state artifact-${plan.crewPlan.availabilityStatus}`} />
          <span>
            <strong>{plan.crewPlan.crewName}</strong>
            <small className="muted">
              {artifactLabels[plan.crewPlan.availabilityStatus]} | {plan.crewPlan.crewSize} people | supervisor {plan.crewPlan.supervisor}
            </small>
          </span>
        </li>
        {plan.equipmentPlan.map((item) => (
          <li key={item.id}>
            <span className={`artifact-state artifact-${item.status}`} />
            <span>
              <strong>{item.name}</strong>
              <small className="muted">
                {artifactLabels[item.status]} | owner {item.owner} | needed {item.neededDate}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
