import { artifactLabels } from "@/lib/d5o/presentation";
import type { MobilizationPlan } from "@/lib/d5o/types";

export function QualityWorkPackagePanel({ plan }: { plan: MobilizationPlan }) {
  const readyPackages = plan.workPackages.filter(
    (workPackage) => workPackage.status === "ready_for_field" || workPackage.status === "in_progress"
  ).length;

  return (
    <section className="control-list">
      <h3>Quality and Work Packages</h3>
      <ul className="compact-list">
        <li>
          <span className={`artifact-state artifact-${plan.qualityPlanStatus}`} />
          <span>
            <strong>Quality inspection/test plan</strong>
            <small className="muted">{artifactLabels[plan.qualityPlanStatus]}</small>
          </span>
        </li>
        <li>
          <span className={`artifact-state artifact-${plan.requiredSubmittalsStatus}`} />
          <span>
            <strong>Required submittals</strong>
            <small className="muted">{artifactLabels[plan.requiredSubmittalsStatus]}</small>
          </span>
        </li>
        <li>
          <span className="artifact-state artifact-complete" />
          <span>
            <strong>Work packages ready</strong>
            <small className="muted">
              {readyPackages} of {plan.workPackages.length} ready or started
            </small>
          </span>
        </li>
      </ul>
    </section>
  );
}
