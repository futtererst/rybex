import {
  baselineStatusLabels,
  baselineStatusTone
} from "@/lib/d5o/project-config";
import { chipClass, currency, dateLabel } from "@/lib/d5o/presentation";
import type { RybexProject } from "@/lib/d5o/types";

export function ProjectBaselineCard({ project }: { project: RybexProject }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <div>
          <p className="eyebrow">Budget and Schedule</p>
          <h3>{currency.format(project.contractValue)}</h3>
        </div>
        <span className={chipClass(baselineStatusTone[project.baselineBudgetStatus])}>
          Budget {baselineStatusLabels[project.baselineBudgetStatus]}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail">
          <span>Original Estimate</span>
          <strong>{currency.format(project.originalEstimateValue)}</strong>
        </div>
        <div className="detail">
          <span>Pending Changes</span>
          <strong>{currency.format(project.pendingChangeValue)}</strong>
        </div>
        <div className="detail">
          <span>Schedule</span>
          <strong>
            {dateLabel(project.scheduleStart)} to {dateLabel(project.scheduleFinish)}
          </strong>
        </div>
        <div className="detail">
          <span>Schedule Status</span>
          <strong>{baselineStatusLabels[project.baselineScheduleStatus]}</strong>
        </div>
      </div>
    </article>
  );
}
