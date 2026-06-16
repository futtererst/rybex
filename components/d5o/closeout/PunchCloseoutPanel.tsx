import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { qualitySeverityLabels, qualitySeverityTone, qualityStatusLabels, qualityStatusTone } from "@/lib/d5o/quality-config";
import type { PunchItem, QualityDeficiency } from "@/lib/d5o/types";

export function PunchCloseoutPanel({
  punchItems,
  deficiencies
}: {
  punchItems: PunchItem[];
  deficiencies: QualityDeficiency[];
}) {
  const risks = [
    ...punchItems.filter((item) => item.closeoutImpact && !["closed", "verified"].includes(item.status)),
    ...deficiencies.filter((item) => item.closeoutImpact && !["closed", "verified"].includes(item.status))
  ];

  return (
    <section className="control-list">
      <h3>Punch and deficiency closeout risk</h3>
      <ul className="record-list">
        {risks.slice(0, 10).map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.projectName} | {"dueDate" in item ? dateLabel(item.dueDate) : item.location}</span>
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
