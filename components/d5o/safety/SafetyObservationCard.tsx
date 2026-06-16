import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { safetyObservationTypeLabels, safetySeverityLabels, safetySeverityTone, safetyStatusLabels, safetyStatusTone } from "@/lib/d5o/safety-config";
import type { SafetyObservation } from "@/lib/d5o/types";

export function SafetyObservationCard({ observation }: { observation: SafetyObservation }) {
  return (
    <article className="project-card">
      <div className="card-title-row">
        <div>
          <h3>{safetyObservationTypeLabels[observation.type]}</h3>
          <p>{observation.projectName}</p>
        </div>
        <span className={chipClass(safetySeverityTone[observation.severity])}>{safetySeverityLabels[observation.severity]}</span>
      </div>
      <p>{observation.description}</p>
      <dl className="card-meta">
        <div><dt>Status</dt><dd><span className={chipClass(safetyStatusTone[observation.status])}>{safetyStatusLabels[observation.status]}</span></dd></div>
        <div><dt>Owner</dt><dd>{observation.assignedTo}</dd></div>
        <div><dt>Due</dt><dd>{dateLabel(observation.dueDate)}</dd></div>
        <div><dt>Location</dt><dd>{observation.location}</dd></div>
      </dl>
      <p className={observation.closeoutImpact ? "missing-callout" : "ready-callout"}>{observation.nextAction}</p>
    </article>
  );
}
