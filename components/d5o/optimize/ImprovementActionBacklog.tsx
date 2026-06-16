import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { improvementStatusLabels, optimizeSeverityTone, optimizeStatusTone, targetModuleLabels } from "@/lib/d5o/optimize-config";
import type { ImprovementAction } from "@/lib/d5o/types";

export function ImprovementActionBacklog({ actions }: { actions: ImprovementAction[] }) {
  return (
    <section className="control-list">
      <h3>Improvement action backlog</h3>
      <ul className="record-list">
        {actions.map((action) => (
          <li key={action.id}>
            <div>
              <strong>{action.title}</strong>
              <span>{action.owner} | due {dateLabel(action.dueDate)} | {targetModuleLabels[action.targetModule]}</span>
            </div>
            <span className={chipClass(optimizeSeverityTone[action.priority])}>{action.priority}</span>
            <span className={chipClass(optimizeStatusTone[action.status])}>{improvementStatusLabels[action.status]}</span>
            <p>{action.expectedBenefit}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
