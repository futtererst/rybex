import {
  lienWaiverStatusLabels,
  lienWaiverStatusTone,
  waiverTypeLabels
} from "@/lib/d5o/billing-config";
import { chipClass, currency, dateLabel } from "@/lib/d5o/presentation";
import type { LienWaiver, PayApplication } from "@/lib/d5o/types";

export function RetainageLienWaiverPanel({
  payApplications,
  lienWaivers
}: {
  payApplications: PayApplication[];
  lienWaivers: LienWaiver[];
}) {
  const retainageHeld = payApplications.reduce((total, payApp) => total + payApp.totalRetainageHeld, 0);
  const waiverIssues = lienWaivers.filter((waiver) =>
    ["required", "pending", "rejected", "missing"].includes(waiver.status)
  );

  return (
    <section className="control-list">
      <h3>Retainage and Lien Waivers</h3>
      <p className="missing-callout">Retainage held: {currency.format(retainageHeld)}</p>
      {waiverIssues.length > 0 ? (
        <ul className="compact-list">
          {waiverIssues.map((waiver) => (
            <li key={waiver.id}>
              <span className="artifact-state artifact-missing" />
              <span>
                <strong>{waiverTypeLabels[waiver.waiverType]}</strong>
                <small className="muted">{currency.format(waiver.amount)} | due {dateLabel(waiver.requiredDate)}</small>
                <p><span className={chipClass(lienWaiverStatusTone[waiver.status])}>{lienWaiverStatusLabels[waiver.status]}</span> {waiver.notes}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Lien waiver status is current.</p>
      )}
    </section>
  );
}
