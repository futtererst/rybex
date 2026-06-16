import { chipClass } from "@/lib/d5o/presentation";
import type { ProductionRateRecord } from "@/lib/d5o/types";

export function ProductionRateLibrary({ rates }: { rates: ProductionRateRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>Work Type</th>
            <th>Crew / Region</th>
            <th>Estimated</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>Recommended Rate</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.id}>
              <td><strong>{rate.workType}</strong><small>{rate.serviceLine.replaceAll("_", " ")}</small></td>
              <td>{rate.crewType}<small>{rate.region}</small></td>
              <td>{rate.estimatedRate} {rate.unitOfMeasure}</td>
              <td>{rate.actualRate} {rate.unitOfMeasure}</td>
              <td><span className={chipClass(Math.abs(rate.variancePercent) >= 15 ? "critical" : "info")}>{rate.variancePercent}%</span></td>
              <td>{rate.recommendedEstimatingRate} {rate.unitOfMeasure}</td>
              <td>{rate.confidenceLevel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
