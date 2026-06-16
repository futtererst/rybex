import { chipClass } from "@/lib/d5o/presentation";
import { lessonCategoryLabels, optimizeSeverityLabels, optimizeSeverityTone, targetModuleLabels } from "@/lib/d5o/optimize-config";
import type { RiskLibraryItem } from "@/lib/d5o/types";

export function RiskLibraryUpdatePanel({ risks }: { risks: RiskLibraryItem[] }) {
  return (
    <section className="control-list">
      <h3>Risk library updates</h3>
      <ul className="record-list">
        {risks.map((risk) => (
          <li key={risk.id}>
            <div>
              <strong>{risk.title}</strong>
              <span>{lessonCategoryLabels[risk.riskCategory]} | affects {risk.affectedModules.map((module) => targetModuleLabels[module]).join(", ")}</span>
            </div>
            <span className={chipClass(optimizeSeverityTone[risk.severity])}>{optimizeSeverityLabels[risk.severity]}</span>
            <p>{risk.recommendedMitigation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
