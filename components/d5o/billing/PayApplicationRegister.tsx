import {
  billingBackupStatusLabels,
  billingBackupStatusTone,
  lienWaiverStatusLabels,
  lienWaiverStatusTone,
  payApplicationStatusLabels,
  payApplicationStatusTone
} from "@/lib/d5o/billing-config";
import { chipClass, currency, dateLabel } from "@/lib/d5o/presentation";
import type { PayApplication } from "@/lib/d5o/types";

export function PayApplicationRegister({ payApplications }: { payApplications: PayApplication[] }) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>Pay App</th>
            <th>Period</th>
            <th>Status</th>
            <th>Requested</th>
            <th>Approved / Paid</th>
            <th>Backup</th>
            <th>Lien Waiver</th>
            <th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          {payApplications.map((payApp) => (
            <tr key={payApp.id}>
              <td><strong>{payApp.payApplicationNumber}</strong><small>{payApp.projectName}</small></td>
              <td>{dateLabel(payApp.billingPeriodStart)}<small>to {dateLabel(payApp.billingPeriodEnd)}</small></td>
              <td><span className={chipClass(payApplicationStatusTone[payApp.status])}>{payApplicationStatusLabels[payApp.status]}</span></td>
              <td>{currency.format(payApp.amountRequestedThisPeriod)}<small>retainage {currency.format(payApp.retainageThisPeriod)}</small></td>
              <td>{currency.format(payApp.amountApprovedThisPeriod)}<small>paid {currency.format(payApp.amountPaidThisPeriod)}</small></td>
              <td><span className={chipClass(billingBackupStatusTone[payApp.backupStatus])}>{billingBackupStatusLabels[payApp.backupStatus]}</span></td>
              <td><span className={chipClass(lienWaiverStatusTone[payApp.lienWaiverStatus])}>{lienWaiverStatusLabels[payApp.lienWaiverStatus]}</span></td>
              <td>{payApp.nextAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
