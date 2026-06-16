import Link from "next/link";
import { evaluateD3Gate } from "@/lib/d5o/d3-gate";
import {
  mobilizationDecisionLabels,
  mobilizationDecisionTone,
  mobilizationStatusLabels,
  mobilizationStatusTone
} from "@/lib/d5o/mobilization-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { MobilizationPlan, RybexProject } from "@/lib/d5o/types";

export function MobilizationReadinessCard({
  plan,
  project
}: {
  plan: MobilizationPlan;
  project?: RybexProject;
}) {
  const readiness = evaluateD3Gate(plan, project);

  return (
    <article className="opportunity-card" id={plan.id}>
      <div className="opportunity-card-top">
        <div>
          <h3>{plan.projectName}</h3>
          <p className="muted">Field start {dateLabel(plan.plannedFieldStartDate)}</p>
        </div>
        <span className={chipClass(mobilizationStatusTone[plan.readinessStatus])}>
          {mobilizationStatusLabels[plan.readinessStatus]}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail">
          <span>Owner</span>
          <strong>{plan.mobilizationOwner}</strong>
        </div>
        <div className="detail">
          <span>Supervisor</span>
          <strong>{plan.fieldSupervisor}</strong>
        </div>
        <div className="detail">
          <span>Readiness</span>
          <strong>{readiness.readinessPercent}%</strong>
        </div>
        <div className="detail">
          <span>Decision</span>
          <strong>{mobilizationDecisionLabels[readiness.recommendedDecision]}</strong>
        </div>
      </div>
      <div className="opportunity-score-row">
        <span className={chipClass(mobilizationDecisionTone[readiness.recommendedDecision])}>
          {mobilizationDecisionLabels[readiness.recommendedDecision]}
        </span>
        <strong>{plan.blockers.length} blockers</strong>
      </div>
      <div className="card-row">
        <span className="muted">{plan.nextAction}</span>
        <Link className="button button-secondary" href={`/mobilization#${plan.id}`}>
          Review
        </Link>
      </div>
    </article>
  );
}
