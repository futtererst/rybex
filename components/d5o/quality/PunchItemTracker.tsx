import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { qualitySeverityLabels, qualitySeverityTone, qualityStatusLabels, qualityStatusTone } from "@/lib/d5o/quality-config";
import type { PunchItem } from "@/lib/d5o/types";

export function PunchItemTracker({ punchItems }: { punchItems: PunchItem[] }) {
  return (
    <section className="control-list">
      <h3>Punch item tracker</h3>
      <ul className="record-list">
        {punchItems.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.projectName} | due {dateLabel(item.dueDate)}</span>
            </div>
            <span className={chipClass(qualitySeverityTone[item.severity])}>{qualitySeverityLabels[item.severity]}</span>
            <span className={chipClass(qualityStatusTone[item.status])}>{qualityStatusLabels[item.status]}</span>
            <p>{item.nextAction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
