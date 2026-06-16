import { chipClass } from "@/lib/d5o/presentation";
import { scoreTone, vendorPostureLabels, vendorPostureTone } from "@/lib/d5o/optimize-config";
import type { VendorPerformanceProfile } from "@/lib/d5o/types";

export function VendorPerformanceProfileCard({ profile }: { profile: VendorPerformanceProfile }) {
  return (
    <article className="project-card">
      <div className="card-title-row">
        <div>
          <h3>{profile.vendorName}</h3>
          <p>{profile.vendorType} | {profile.scopeCategories.join(", ")}</p>
        </div>
        <span className={chipClass(scoreTone(profile.overallScore))}>{profile.overallScore}</span>
      </div>
      <dl className="card-meta">
        <div><dt>Delivery</dt><dd>{profile.deliveryReliabilityScore}</dd></div>
        <div><dt>Quality</dt><dd>{profile.qualityScore}</dd></div>
        <div><dt>Docs</dt><dd>{profile.documentationScore}</dd></div>
        <div><dt>Response</dt><dd>{profile.responsivenessScore}</dd></div>
      </dl>
      <span className={chipClass(vendorPostureTone[profile.recommendedUsePosture])}>{vendorPostureLabels[profile.recommendedUsePosture]}</span>
      <p>{profile.notes}</p>
    </article>
  );
}
