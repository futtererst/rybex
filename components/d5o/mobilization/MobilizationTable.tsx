import { evaluateD3Gate } from "@/lib/d5o/d3-gate";
import {
  mobilizationDecisionLabels,
  mobilizationDecisionTone,
  mobilizationStatusLabels,
  mobilizationStatusTone
} from "@/lib/d5o/mobilization-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { MobilizationPlan, RybexProject } from "@/lib/d5o/types";

export function MobilizationTable({
  plans,
  projects
}: {
  plans: MobilizationPlan[];
  projects: RybexProject[];
}) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>Mobilization</th>
            <th>Field Start</th>
            <th>Status</th>
            <th>Readiness</th>
            <th>Decision</th>
            <th>Owner</th>
            <th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const project = projects.find((candidate) => candidate.id === plan.projectId);
            const readiness = evaluateD3Gate(plan, project);

            return (
              <tr id={plan.id} key={plan.id}>
                <td>
                  <strong>{plan.projectName}</strong>
                  <small className="muted">{project?.gcClient ?? "Project source missing"}</small>
                </td>
                <td>{dateLabel(plan.plannedFieldStartDate)}</td>
                <td>
                  <span className={chipClass(mobilizationStatusTone[plan.readinessStatus])}>
                    {mobilizationStatusLabels[plan.readinessStatus]}
                  </span>
                </td>
                <td>{readiness.readinessPercent}%</td>
                <td>
                  <span className={chipClass(mobilizationDecisionTone[readiness.recommendedDecision])}>
                    {mobilizationDecisionLabels[readiness.recommendedDecision]}
                  </span>
                </td>
                <td>{plan.mobilizationOwner}</td>
                <td>{plan.nextAction}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
