import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { safetySeverityLabels, safetySeverityTone, safetyStatusLabels, safetyStatusTone } from "@/lib/d5o/safety-config";
import type { CorrectiveAction } from "@/lib/d5o/types";

export function CorrectiveActionTracker({ actions }: { actions: CorrectiveAction[] }) {
  const openActions = actions.filter((action) => !["closed", "verified"].includes(action.status));

  return (
    <section className="control-list">
      <h3>Corrective action tracker</h3>
      {openActions.length === 0 ? (
        <p className="empty-state">No open corrective actions.</p>
      ) : (
        <ul className="record-list">
          {openActions.map((action) => (
            <li key={action.id}>
              <div>
                <strong>{action.title}</strong>
                <span>{action.projectName} | due {dateLabel(action.dueDate)}</span>
              </div>
              <span className={chipClass(safetySeverityTone[action.severity as keyof typeof safetySeverityTone])}>{safetySeverityLabels[action.severity as keyof typeof safetySeverityLabels]}</span>
              <span className={chipClass(safetyStatusTone[action.status])}>{safetyStatusLabels[action.status]}</span>
              <p>{action.nextAction}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
