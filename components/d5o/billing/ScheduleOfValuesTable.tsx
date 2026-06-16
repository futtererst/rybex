import { billingBackupStatusLabels, billingBackupStatusTone } from "@/lib/d5o/billing-config";
import { chipClass, currency } from "@/lib/d5o/presentation";
import type { ScheduleOfValueLine } from "@/lib/d5o/types";

export function ScheduleOfValuesTable({ lines }: { lines: ScheduleOfValueLine[] }) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Revised Value</th>
            <th>Previous</th>
            <th>Current</th>
            <th>Stored</th>
            <th>% Complete</th>
            <th>Backup</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td><strong>{line.description}</strong><small>{line.costCode}</small></td>
              <td>{currency.format(line.revisedValue)}</td>
              <td>{currency.format(line.previousBilled)}</td>
              <td>{currency.format(line.currentBilled)}</td>
              <td>{currency.format(line.storedMaterials)}</td>
              <td>{line.percentComplete}%<small>remaining {currency.format(line.remainingBalance)}</small></td>
              <td><span className={chipClass(billingBackupStatusTone[line.backupStatus])}>{billingBackupStatusLabels[line.backupStatus]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
