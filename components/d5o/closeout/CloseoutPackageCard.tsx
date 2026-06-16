import Link from "next/link";
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

export function CloseoutPackageCard({ closeoutPackage }: { closeoutPackage: CloseoutPackage }) {
  return (
    <article className="project-card">
      <div className="card-title-row">
        <div>
          <h3>{closeoutPackage.projectName}</h3>
          <p>{closeoutPackage.packageNumber} | target {dateLabel(closeoutPackage.targetSubmissionDate)}</p>
        </div>
        <span className={chipClass(closeoutStatusTone[closeoutPackage.status])}>{closeoutStatusLabels[closeoutPackage.status]}</span>
      </div>
      <dl className="card-meta">
        <div><dt>Readiness</dt><dd>{closeoutPackage.readinessScore}%</dd></div>
        <div><dt>Acceptance</dt><dd><span className={chipClass(acceptanceStatusTone[closeoutPackage.acceptanceStatus])}>{acceptanceStatusLabels[closeoutPackage.acceptanceStatus]}</span></dd></div>
        <div><dt>Retainage</dt><dd><span className={chipClass(retainageReleaseStatusTone[closeoutPackage.retainageReleaseStatus])}>{retainageReleaseStatusLabels[closeoutPackage.retainageReleaseStatus]}</span></dd></div>
        <div><dt>Owner</dt><dd>{closeoutPackage.closeoutOwner}</dd></div>
      </dl>
      {closeoutPackage.blockers.length > 0 ? (
        <p className="missing-callout">{closeoutPackage.blockers[0]}</p>
      ) : (
        <p className="ready-callout">{closeoutPackage.nextAction}</p>
      )}
      <Link className="button button-secondary" href="/closeout/package/new">Review Package</Link>
    </article>
  );
}
