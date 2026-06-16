import { payApplicationStatusLabels, payApplicationStatusTone } from "@/lib/d5o/billing-config";
import { chipClass, currency, dateLabel } from "@/lib/d5o/presentation";
import type { PayApplication } from "@/lib/d5o/types";

export function PaymentAgingPanel({ payApplications }: { payApplications: PayApplication[] }) {
  const aging = payApplications.filter((payApp) =>
    ["aging", "submitted", "partially_paid", "disputed"].includes(payApp.status)
  );

  return (
    <section className="control-list">
      <h3>Payment Aging and Follow-up</h3>
      {aging.length > 0 ? (
        <ul className="compact-list">
          {aging.map((payApp) => (
            <li key={payApp.id}>
              <span className="artifact-state artifact-pending" />
              <span>
                <strong>{payApp.payApplicationNumber}: {payApp.projectName}</strong>
                <small className="muted">due {dateLabel(payApp.paymentDueDate)} | requested {currency.format(payApp.amountRequestedThisPeriod)}</small>
                <p><span className={chipClass(payApplicationStatusTone[payApp.status])}>{payApplicationStatusLabels[payApp.status]}</span> {payApp.nextAction}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No submitted pay applications need follow-up.</p>
      )}
    </section>
  );
}
