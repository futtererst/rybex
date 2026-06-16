import {
  riskLevelLabels,
  riskLevelTone
} from "@/lib/d5o/opportunity-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { OpportunityRiskFactor } from "@/lib/d5o/types";

type OpportunityRiskPanelProps = {
  risks: OpportunityRiskFactor[];
};

export function OpportunityRiskPanel({ risks }: OpportunityRiskPanelProps) {
  const groupedRisks = risks.reduce<Record<string, OpportunityRiskFactor[]>>((groups, risk) => {
    const group = groups[risk.category] ?? [];
    return {
      ...groups,
      [risk.category]: [...group, risk]
    };
  }, {});

  if (risks.length === 0) {
    return (
      <section className="risk-panel">
        <p className="muted">No material risk factors have been logged for this pursuit.</p>
      </section>
    );
  }

  return (
    <section className="risk-panel">
      {Object.entries(groupedRisks).map(([category, categoryRisks]) => (
        <div className="risk-category" key={category}>
          <h4>{category.replaceAll("_", " ")}</h4>
          {categoryRisks.map((risk) => (
            <article className="risk-item" key={risk.id}>
              <div className="status-row">
                <strong>{risk.title}</strong>
                <span className={chipClass(riskLevelTone[risk.severity])}>
                  {riskLevelLabels[risk.severity]}
                </span>
              </div>
              <p>{risk.rationale}</p>
              <small className="muted">
                Mitigation: {risk.mitigation}
                {risk.owner ? ` | Owner: ${risk.owner}` : ""}
              </small>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
