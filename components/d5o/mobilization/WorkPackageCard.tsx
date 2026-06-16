import {
  workPackageStatusLabels,
  workPackageStatusTone
} from "@/lib/d5o/mobilization-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { WorkPackage } from "@/lib/d5o/types";

export function WorkPackageCard({ workPackage }: { workPackage: WorkPackage }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <div>
          <h3>{workPackage.name}</h3>
          <p className="muted">{workPackage.location}</p>
        </div>
        <span className={chipClass(workPackageStatusTone[workPackage.status])}>
          {workPackageStatusLabels[workPackage.status]}
        </span>
      </div>
      <p className="muted">{workPackage.scopeDescription}</p>
      <div className="detail-grid">
        <div className="detail">
          <span>Crew</span>
          <strong>{workPackage.assignedCrew}</strong>
        </div>
        <div className="detail">
          <span>Supervisor</span>
          <strong>{workPackage.fieldSupervisor}</strong>
        </div>
        <div className="detail">
          <span>Dates</span>
          <strong>
            {dateLabel(workPackage.plannedStartDate)} to {dateLabel(workPackage.plannedFinishDate)}
          </strong>
        </div>
        <div className="detail">
          <span>Production Target</span>
          <strong>{workPackage.productionTarget}</strong>
        </div>
      </div>
      {workPackage.blockers.length > 0 && (
        <p className="missing-callout">Blocked: {workPackage.blockers.join(", ")}</p>
      )}
    </article>
  );
}
