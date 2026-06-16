import { currency, dateLabel } from "@/lib/d5o/presentation";
import type { LienWaiver, PayApplication } from "@/lib/d5o/types";

export function RetainageReleasePanel({
  payApplications,
  lienWaivers
}: {
  payApplications: PayApplication[];
  lienWaivers: LienWaiver[];
}) {
  const retainageHeld = payApplications.reduce((total, payApp) => total + payApp.totalRetainageHeld, 0);
  const waiverIssues = lienWaivers.filter((waiver) =>
    ["required", "pending", "missing", "rejected"].includes(waiver.status)
  );

  return (
    <section className="control-list">
      <h3>Retainage and lien waiver readiness</h3>
      <p><strong>{currency.format(retainageHeld)}</strong> retainage currently held across closeout-related pay apps.</p>
      <ul className="record-list">
        {waiverIssues.map((waiver, index) => (
          <li key={`retainage-waiver-${waiver.id}-${waiver.waiverType}-${index}`}>
            <div>
              <strong>{waiver.waiverType.replaceAll("_", " ")} waiver</strong>
              <span>{currency.format(waiver.amount)} | required {dateLabel(waiver.requiredDate)}</span>
            </div>
            <p>{waiver.notes}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
