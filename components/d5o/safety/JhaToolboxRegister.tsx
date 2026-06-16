import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { safetyStatusLabels, safetyStatusTone } from "@/lib/d5o/safety-config";
import type { JhaRecord } from "@/lib/d5o/types";

export function JhaToolboxRegister({ records }: { records: JhaRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>JHA / Talk</th>
            <th>Project</th>
            <th>Date</th>
            <th>Status</th>
            <th>Acknowledged</th>
            <th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td><strong>{record.title}</strong><small>{record.recordType === "jha" ? "JHA/JSA" : "Toolbox talk"}</small></td>
              <td>{record.projectName}</td>
              <td>{dateLabel(record.date)}</td>
              <td><span className={chipClass(safetyStatusTone[record.status])}>{safetyStatusLabels[record.status]}</span></td>
              <td>{record.crewAcknowledged ? "Yes" : "No"}</td>
              <td>{record.nextAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
