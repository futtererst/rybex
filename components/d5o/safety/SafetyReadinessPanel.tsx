import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { safetyStatusLabels, safetyStatusTone } from "@/lib/d5o/safety-config";
import type { SafetyPlan } from "@/lib/d5o/types";

export function SafetyReadinessPanel({ safetyPlans }: { safetyPlans: SafetyPlan[] }) {
  if (safetyPlans.length === 0) {
    return <section className="control-list"><h3>Safety readiness</h3><p className="empty-state">No safety plans are loaded.</p></section>;
  }

  return (
    <section className="control-list">
      <h3>Safety readiness by project</h3>
      <ul className="record-list">
        {safetyPlans.map((plan) => (
          <li key={plan.id}>
            <div>
              <strong>{plan.planName}</strong>
              <span>{plan.projectName} | effective {dateLabel(plan.effectiveDate)}</span>
            </div>
            <span className={chipClass(safetyStatusTone[plan.status])}>{safetyStatusLabels[plan.status]}</span>
            <p>{plan.nextAction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
