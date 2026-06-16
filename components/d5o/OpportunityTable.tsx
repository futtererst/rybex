import { calculateGoNoGo } from "@/lib/d5o/go-no-go";
import {
  opportunityStatusMap,
  recommendationLabels,
  recommendationTone,
  riskLevelLabels,
  riskLevelTone
} from "@/lib/d5o/opportunity-config";
import { chipClass, compactCurrency, dateLabel } from "@/lib/d5o/presentation";
import type { Opportunity } from "@/lib/d5o/types";

type OpportunityTableProps = {
  opportunities: Opportunity[];
};

export function OpportunityTable({ opportunities }: OpportunityTableProps) {
  if (opportunities.length === 0) {
    return <p className="muted">No opportunities are currently in this pipeline view.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>Opportunity</th>
            <th>GC / Client</th>
            <th>Bid Due</th>
            <th>Value</th>
            <th>Status</th>
            <th>Score</th>
            <th>Risk</th>
            <th>Recommendation</th>
            <th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opportunity) => {
            const score = calculateGoNoGo(opportunity);
            const status = opportunityStatusMap[opportunity.status];

            return (
              <tr id={opportunity.id} key={opportunity.id}>
                <td>
                  <strong>{opportunity.name}</strong>
                  <small className="muted">{opportunity.projectLocation}</small>
                </td>
                <td>{opportunity.gcClient}</td>
                <td>{dateLabel(opportunity.bidDueDate)}</td>
                <td>{compactCurrency.format(opportunity.estimatedValue)}</td>
                <td>
                  <span className={chipClass(status.tone)}>{status.label}</span>
                </td>
                <td>{score.totalScore}/100</td>
                <td>
                  <span className={chipClass(riskLevelTone[score.riskLevel])}>
                    {riskLevelLabels[score.riskLevel]}
                  </span>
                </td>
                <td>
                  <span className={chipClass(recommendationTone[score.recommendation])}>
                    {recommendationLabels[score.recommendation]}
                  </span>
                </td>
                <td>{opportunity.nextAction}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
