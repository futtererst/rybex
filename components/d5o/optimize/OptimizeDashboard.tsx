import { GcPerformanceProfileCard } from "./GcPerformanceProfileCard";
import { ImprovementActionBacklog } from "./ImprovementActionBacklog";
import { LessonsLearnedRegister } from "./LessonsLearnedRegister";
import { OptimizeControlScoreCard } from "./OptimizeControlScoreCard";
import { ProductionRateLibrary } from "./ProductionRateLibrary";
import { ProductionRateVariancePanel } from "./ProductionRateVariancePanel";
import { ProjectScorecardGrid } from "./ProjectScorecardGrid";
import { RiskLibraryUpdatePanel } from "./RiskLibraryUpdatePanel";
import { VendorPerformanceProfileCard } from "./VendorPerformanceProfileCard";
import type { GcPerformanceProfile, ImprovementAction, LessonLearned, ProductionRateRecord, ProjectPerformanceScorecard, RiskLibraryItem, VendorPerformanceProfile } from "@/lib/d5o/types";

export function OptimizeDashboard({
  scorecards,
  lessons,
  productionRates,
  gcProfiles,
  vendorProfiles,
  improvementActions,
  riskLibrary
}: {
  scorecards: ProjectPerformanceScorecard[];
  lessons: LessonLearned[];
  productionRates: ProductionRateRecord[];
  gcProfiles: GcPerformanceProfile[];
  vendorProfiles: VendorPerformanceProfile[];
  improvementActions: ImprovementAction[];
  riskLibrary: RiskLibraryItem[];
}) {
  return (
    <>
      <div className="content-grid">
        <OptimizeControlScoreCard
          scorecards={scorecards}
          lessons={lessons}
          productionRates={productionRates}
          gcProfiles={gcProfiles}
          vendorProfiles={vendorProfiles}
          improvementActions={improvementActions}
          riskLibrary={riskLibrary}
        />
        <ProductionRateVariancePanel rates={productionRates} />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Project Performance Scorecards</p>
            <h2>Margin, schedule, production, safety, quality, and documentation outcomes</h2>
          </div>
          <span className="muted">{scorecards.length} reviewed projects</span>
        </div>
        <ProjectScorecardGrid scorecards={scorecards} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Lessons Learned</p>
            <h2>Operating changes tied to owners and modules</h2>
          </div>
        </div>
        <LessonsLearnedRegister lessons={lessons} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Production Rate Library</p>
            <h2>Estimated versus actual rates for future bids</h2>
          </div>
          <span className="muted">{productionRates.length} rate records</span>
        </div>
        <ProductionRateLibrary rates={productionRates} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GC / Client Performance</p>
            <h2>Future pursuit posture by client behavior</h2>
          </div>
        </div>
        <div className="project-detail-grid">
          {gcProfiles.map((profile) => <GcPerformanceProfileCard key={profile.id} profile={profile} />)}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vendor / Subcontractor Performance</p>
            <h2>Recommended use posture by delivery, quality, and documentation</h2>
          </div>
        </div>
        <div className="project-detail-grid">
          {vendorProfiles.map((profile) => <VendorPerformanceProfileCard key={profile.id} profile={profile} />)}
        </div>
      </section>

      <div className="operating-columns">
        <ImprovementActionBacklog actions={improvementActions} />
        <RiskLibraryUpdatePanel risks={riskLibrary} />
      </div>
    </>
  );
}
