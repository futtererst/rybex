import {
  priorityLabels,
  priorityTone,
  rfiStatusLabels,
  rfiStatusTone
} from "@/lib/d5o/rfi-submittal-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { RFI } from "@/lib/d5o/types";

export function RfiTable({ rfis }: { rfis: RFI[] }) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>RFI</th>
            <th>Project</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Impact</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          {rfis.map((rfi) => (
            <tr key={rfi.id}>
              <td><strong>{rfi.rfiNumber}</strong><small>{rfi.title}</small></td>
              <td>{rfi.projectName}<small>{rfi.location}</small></td>
              <td><span className={chipClass(rfiStatusTone[rfi.status])}>{rfiStatusLabels[rfi.status]}</span></td>
              <td><span className={chipClass(priorityTone[rfi.priority])}>{priorityLabels[rfi.priority]}</span></td>
              <td>{dateLabel(rfi.dueDate)}<small>{rfi.assignedTo}</small></td>
              <td>{rfi.scheduleImpact ? "Schedule " : ""}{rfi.costImpact ? "Cost" : ""}</td>
              <td>{rfi.nextAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
