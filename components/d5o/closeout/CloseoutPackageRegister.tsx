import {
  acceptanceStatusLabels,
  acceptanceStatusTone,
  closeoutStatusLabels,
  closeoutStatusTone,
  retainageReleaseStatusLabels,
  retainageReleaseStatusTone
} from "@/lib/d5o/closeout-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { CloseoutPackage } from "@/lib/d5o/types";

export function CloseoutPackageRegister({ packages }: { packages: CloseoutPackage[] }) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Status</th>
            <th>Readiness</th>
            <th>Acceptance</th>
            <th>Final Billing</th>
            <th>Retainage</th>
            <th>Target</th>
            <th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.packageNumber}</strong><small>{item.projectName}</small></td>
              <td><span className={chipClass(closeoutStatusTone[item.status])}>{closeoutStatusLabels[item.status]}</span></td>
              <td>{item.readinessScore}%</td>
              <td><span className={chipClass(acceptanceStatusTone[item.acceptanceStatus])}>{acceptanceStatusLabels[item.acceptanceStatus]}</span></td>
              <td>{item.finalBillingStatus.replaceAll("_", " ")}</td>
              <td><span className={chipClass(retainageReleaseStatusTone[item.retainageReleaseStatus])}>{retainageReleaseStatusLabels[item.retainageReleaseStatus]}</span></td>
              <td>{dateLabel(item.targetSubmissionDate)}</td>
              <td>{item.nextAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
