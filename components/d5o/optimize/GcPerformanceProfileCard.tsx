import { chipClass, compactCurrency } from "@/lib/d5o/presentation";
import { pursuitPostureLabels, pursuitPostureTone, scoreTone } from "@/lib/d5o/optimize-config";
import type { GcPerformanceProfile } from "@/lib/d5o/types";

export function GcPerformanceProfileCard({ profile }: { profile: GcPerformanceProfile }) {
  return (
    <article className="project-card">
      <div className="card-title-row">
        <div>
          <h3>{profile.gcClient}</h3>
          <p>{profile.projectCount} project(s) | {compactCurrency.format(profile.totalContractValue)}</p>
        </div>
        <span className={chipClass(scoreTone(profile.overallScore))}>{profile.overallScore}</span>
      </div>
      <dl className="card-meta">
        <div><dt>Payment</dt><dd>{profile.paymentReliabilityScore}</dd></div>
        <div><dt>Changes</dt><dd>{profile.changeApprovalScore}</dd></div>
        <div><dt>Access</dt><dd>{profile.fieldAccessReliabilityScore}</dd></div>
        <div><dt>Dispute Risk</dt><dd>{profile.disputeRiskScore}</dd></div>
      </dl>
      <span className={chipClass(pursuitPostureTone[profile.recommendedPursuitPosture])}>{pursuitPostureLabels[profile.recommendedPursuitPosture]}</span>
      <p>{profile.notes}</p>
    </article>
  );
}
