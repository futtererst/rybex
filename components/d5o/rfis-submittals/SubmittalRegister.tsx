import {
  submittalStatusLabels,
  submittalStatusTone
} from "@/lib/d5o/rfi-submittal-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { Submittal } from "@/lib/d5o/types";

export function SubmittalRegister({ submittals }: { submittals: Submittal[] }) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>Submittal</th>
            <th>Package</th>
            <th>Status</th>
            <th>Required</th>
            <th>Reviewer</th>
            <th>Work impact</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          {submittals.map((submittal) => (
            <tr key={submittal.id}>
              <td><strong>{submittal.submittalNumber}</strong><small>{submittal.title}</small></td>
              <td>{submittal.packageName}<small>{submittal.specificationSection}</small></td>
              <td><span className={chipClass(submittalStatusTone[submittal.status])}>{submittalStatusLabels[submittal.status]}</span></td>
              <td>{dateLabel(submittal.requiredDate)}<small>review {dateLabel(submittal.reviewDueDate)}</small></td>
              <td>{submittal.reviewer}</td>
              <td>{submittal.linkedWorkPackageIds.length} work package(s)</td>
              <td>{submittal.nextAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
