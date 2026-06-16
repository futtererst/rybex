import type { ProductionRateRecord } from "@/lib/d5o/types";

export function ProductionRateVariancePanel({ rates }: { rates: ProductionRateRecord[] }) {
  const updates = rates.filter((rate) => Math.abs(rate.variancePercent) >= 12 && rate.confidenceLevel !== "low");

  return (
    <section className="control-list">
      <h3>Production rate updates</h3>
      <ul className="record-list">
        {updates.map((rate) => (
          <li key={rate.id}>
            <div>
              <strong>{rate.workType}</strong>
              <span>{rate.variancePercent}% variance | use {rate.recommendedEstimatingRate} {rate.unitOfMeasure}</span>
            </div>
            <p>{rate.notes}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
