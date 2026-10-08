import { currency } from "@/lib/d5o/presentation";
import type { ChangeEvent, PayApplication } from "@/lib/d5o/types";

export function CommercialCloseoutPanel({
  changeEvents,
  payApplications
}: {
  changeEvents: ChangeEvent[];
  payApplications: PayApplication[];
}) {
  const unbilled = changeEvents.filter((event) => event.approvedAmount > 0 && event.billingStatus === "approved_not_billed");
  const finalBillingIssues = payApplications.filter((payApp) =>
    ["draft", "aging", "disputed", "rejected", "partially_paid"].includes(payApp.status)
  );

  return (
    <section className="control-list">
      <h3>Final billing / commercial closure</h3>
      <ul className="record-list">
        {unbilled.map((event) => (
          <li key={event.id}>
            <div>
              <strong>{event.changeNumber}: {event.title}</strong>
              <span>{event.projectName} | {currency.format(event.approvedAmount)} approved not billed</span>
            </div>
            <p>{event.requiredAction}</p>
          </li>
        ))}
        {finalBillingIssues.map((payApp) => (
          <li key={payApp.id}>
            <div>
              <strong>{payApp.payApplicationNumber}: {payApp.projectName}</strong>
              <span>{currency.format(payApp.amountRequestedThisPeriod)} requested | {payApp.status.replaceAll("_", " ")}</span>
            </div>
            <p>{payApp.nextAction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
