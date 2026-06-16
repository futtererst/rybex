import { currency } from "@/lib/d5o/presentation";
import type { ChangeEvent } from "@/lib/d5o/types";

export function CommercialExposurePanel({ events }: { events: ChangeEvent[] }) {
  const openExposure = events
    .filter((event) => !["billed", "paid", "closed"].includes(event.billingStatus))
    .reduce((total, event) => total + event.costImpactEstimate, 0);
  const approvedNotBilled = events
    .filter((event) => event.billingStatus === "approved_not_billed")
    .reduce((total, event) => total + event.approvedAmount, 0);
  const disputed = events.reduce((total, event) => total + event.disputedAmount + event.rejectedAmount, 0);

  return (
    <section className="control-list">
      <h3>Commercial Exposure</h3>
      <ul className="plain-list">
        <li>Open estimated exposure: {currency.format(openExposure)}</li>
        <li>Approved not billed: {currency.format(approvedNotBilled)}</li>
        <li>Rejected/disputed value: {currency.format(disputed)}</li>
      </ul>
      {approvedNotBilled > 0 ? (
        <p className="missing-callout">Approved value needs billing support.</p>
      ) : (
        <p className="ready-callout">No approved-but-unbilled change value.</p>
      )}
    </section>
  );
}
