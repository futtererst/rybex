import {
  productionStatusLabels,
  productionStatusTone
} from "@/lib/d5o/field-execution-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { DailyReport } from "@/lib/d5o/types";

export function ProductionProgressPanel({ reports }: { reports: DailyReport[] }) {
  const quantities = reports.flatMap((report) =>
    report.installedQuantities.map((quantity) => ({
      ...quantity,
      projectName: report.projectName,
      productionStatus: report.productionStatus
    }))
  );

  return (
    <section className="control-list">
      <h3>Production Progress</h3>
      {quantities.length > 0 ? (
        <ul className="compact-list">
          {quantities.slice(0, 7).map((quantity) => (
            <li key={quantity.id}>
              <span className="artifact-state artifact-complete" />
              <span>
                <strong>
                  {quantity.description}: {quantity.quantity} {quantity.unit}
                </strong>
                <small className="muted">
                  {quantity.projectName} | target {quantity.productionTarget} {quantity.unit}
                </small>
                <p>
                  <span className={chipClass(productionStatusTone[quantity.productionStatus])}>
                    {productionStatusLabels[quantity.productionStatus]}
                  </span>
                </p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No installed quantities have been captured yet.</p>
      )}
    </section>
  );
}
