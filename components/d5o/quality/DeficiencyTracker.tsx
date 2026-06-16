import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { qualitySeverityLabels, qualitySeverityTone, qualityStatusLabels, qualityStatusTone } from "@/lib/d5o/quality-config";
import type { QualityDeficiency } from "@/lib/d5o/types";

export function DeficiencyTracker({ deficiencies }: { deficiencies: QualityDeficiency[] }) {
  const openDeficiencies = deficiencies.filter((item) => !["closed", "verified"].includes(item.status));

  return (
    <section className="control-list">
      <h3>Deficiency tracker</h3>
      <ul className="record-list">
        {openDeficiencies.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.projectName} | found {dateLabel(item.discoveredDate)}</span>
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
