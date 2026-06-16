import { closeoutRequirementStatusLabels, closeoutRequirementStatusTone } from "@/lib/d5o/closeout-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { AsBuiltRecord } from "@/lib/d5o/types";

export function AsBuiltRedlinePanel({ records }: { records: AsBuiltRecord[] }) {
  return (
    <section className="control-list">
      <h3>As-built / redline status</h3>
      <ul className="record-list">
        {records.map((record) => (
          <li key={record.id}>
            <div>
              <strong>{record.title}</strong>
              <span>{record.drawingReference} | prepared by {record.preparedBy}</span>
            </div>
            <span className={chipClass(closeoutRequirementStatusTone[record.status])}>{closeoutRequirementStatusLabels[record.status]}</span>
            <p>{record.nextAction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
