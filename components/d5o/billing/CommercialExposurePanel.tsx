import {
  commercialExposureStatusLabels,
  commercialExposureStatusTone
} from "@/lib/d5o/billing-config";
import { chipClass, currency, dateLabel } from "@/lib/d5o/presentation";
import type { CommercialExposureItem } from "@/lib/d5o/types";

export function CommercialExposurePanel({
  commercialExposure
}: {
  commercialExposure: CommercialExposureItem[];
}) {
  const openItems = commercialExposure.filter((item) => !["recovered", "written_off"].includes(item.status));

  return (
    <section className="control-list">
      <h3>Commercial Exposure</h3>
      {openItems.length > 0 ? (
        <ul className="compact-list">
          {openItems.map((item) => (
            <li key={item.id}>
              <span className="artifact-state artifact-missing" />
              <span>
                <strong>{item.title}</strong>
                <small className="muted">{currency.format(item.estimatedValue)} | due {dateLabel(item.dueDate)}</small>
                <p><span className={chipClass(commercialExposureStatusTone[item.status])}>{commercialExposureStatusLabels[item.status]}</span> {item.requiredAction}</p>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No open commercial exposure items.</p>
      )}
    </section>
  );
}
