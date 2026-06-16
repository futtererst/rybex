import { acceptanceStatusLabels, acceptanceStatusTone } from "@/lib/d5o/closeout-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { AcceptanceRecord } from "@/lib/d5o/types";

export function AcceptanceQueue({ records }: { records: AcceptanceRecord[] }) {
  return (
    <section className="control-list">
      <h3>Acceptance queue</h3>
      <ul className="record-list">
        {records.map((record) => (
          <li key={record.id}>
            <div>
              <strong>{record.reviewerOrganization}</strong>
              <span>{record.reviewer}{record.submittedDate ? ` | submitted ${dateLabel(record.submittedDate)}` : " | not submitted"}</span>
            </div>
            <span className={chipClass(acceptanceStatusTone[record.status])}>{acceptanceStatusLabels[record.status]}</span>
            <p>{record.nextAction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
