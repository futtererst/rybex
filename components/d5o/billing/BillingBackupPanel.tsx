import { billingBackupStatusLabels, billingBackupStatusTone, billingBackupTypeLabels } from "@/lib/d5o/billing-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { BillingBackupItem } from "@/lib/d5o/types";

export function BillingBackupPanel({ backupItems }: { backupItems: BillingBackupItem[] }) {
  const gaps = backupItems.filter((item) => item.requiredForBilling && ["missing", "partial"].includes(item.status));

  return (
    <section className="control-list">
      <h3>Missing Backup Documentation</h3>
      {gaps.length > 0 ? (
        <ul className="compact-list">
          {gaps.map((item) => (
            <li key={item.id}>
              <span className="artifact-state artifact-pending" />
              <span>
                <strong>{item.title}</strong>
                <small className="muted">{billingBackupTypeLabels[item.type]} | owner {item.owner} | due {dateLabel(item.dueDate)}</small>
                <p><span className={chipClass(billingBackupStatusTone[item.status])}>{billingBackupStatusLabels[item.status]}</span> {item.notes}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Required billing backup is complete.</p>
      )}
    </section>
  );
}
