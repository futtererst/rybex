import { artifactLabels } from "@/lib/d5o/presentation";
import type { MobilizationPlan } from "@/lib/d5o/types";

export function SafetyReadinessPanel({ plan }: { plan: MobilizationPlan }) {
  const items = [
    { id: "safety-plan", name: "Site-specific safety plan", status: plan.safetyPlanStatus },
    { id: "jha", name: "JHA / JSA", status: plan.jhaStatus },
    { id: "kickoff", name: "Kickoff", status: plan.kickoffStatus.status }
  ];

  return (
    <section className="control-list">
      <h3>Safety Readiness</h3>
      <ul className="compact-list">
        {items.map((item) => (
          <li key={item.id}>
            <span className={`artifact-state artifact-${item.status}`} />
            <span>
              <strong>{item.name}</strong>
              <small className="muted">{artifactLabels[item.status]}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
