import { AcceptanceQueue } from "./AcceptanceQueue";
import { ArchivePackagePanel } from "./ArchivePackagePanel";
import { AsBuiltRedlinePanel } from "./AsBuiltRedlinePanel";
import { CloseoutPackageCard } from "./CloseoutPackageCard";
import { CloseoutPackageRegister } from "./CloseoutPackageRegister";
import { CloseoutRequirementTracker } from "./CloseoutRequirementTracker";
import { CommercialCloseoutPanel } from "./CommercialCloseoutPanel";
import { D5ReadinessCard } from "./D5ReadinessCard";
import { PunchCloseoutPanel } from "./PunchCloseoutPanel";
import { RetainageReleasePanel } from "./RetainageReleasePanel";
import { TestEvidenceCloseoutPanel } from "./TestEvidenceCloseoutPanel";
import type {
  AcceptanceRecord,
  AsBuiltRecord,
  ChangeEvent,
  CloseoutPackage,
  CloseoutRequirement,
  CorrectiveAction,
  DailyReport,
  LienWaiver,
  PayApplication,
  PunchItem,
  QualityDeficiency,
  RFI,
  RybexProject,
  Submittal,
  TestRecord,
  WarrantyRecord
} from "@/lib/d5o/types";

export function CloseoutDashboard(props: {
  packages: CloseoutPackage[];
  requirements: CloseoutRequirement[];
  acceptanceRecords: AcceptanceRecord[];
  asBuiltRecords: AsBuiltRecord[];
  warrantyRecords: WarrantyRecord[];
  projects: RybexProject[];
  dailyReports: DailyReport[];
  punchItems: PunchItem[];
  testRecords: TestRecord[];
  qualityDeficiencies: QualityDeficiency[];
  correctiveActions: CorrectiveAction[];
  rfis: RFI[];
  submittals: Submittal[];
  changeEvents: ChangeEvent[];
  payApplications: PayApplication[];
  lienWaivers: LienWaiver[];
}) {
  const firstPackage = props.packages[0];

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Closeout Package Register</p>
            <h2>Acceptance, final billing, retainage, and archive readiness</h2>
          </div>
          <span className="muted">{props.packages.length} packages</span>
        </div>
        <CloseoutPackageRegister packages={props.packages} />
      </section>

      <div className="content-grid">
        {firstPackage ? (
          <D5ReadinessCard
            closeoutPackage={firstPackage}
            project={props.projects.find((project) => project.id === firstPackage.projectId)}
            requirements={props.requirements}
            acceptanceRecords={props.acceptanceRecords}
            dailyReports={props.dailyReports}
            punchItems={props.punchItems}
            testRecords={props.testRecords}
            qualityDeficiencies={props.qualityDeficiencies}
            correctiveActions={props.correctiveActions}
            rfis={props.rfis}
            submittals={props.submittals}
            changeEvents={props.changeEvents}
            payApplications={props.payApplications}
            lienWaivers={props.lienWaivers}
          />
        ) : null}
        <CloseoutRequirementTracker requirements={props.requirements} />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Closeout Readiness by Project</p>
            <h2>Which packages can submit, hold, or archive?</h2>
          </div>
        </div>
        <div className="project-detail-grid">
          {props.packages.map((item) => <CloseoutPackageCard closeoutPackage={item} key={item.id} />)}
        </div>
      </section>

      <div className="operating-columns">
        <AcceptanceQueue records={props.acceptanceRecords} />
        <AsBuiltRedlinePanel records={props.asBuiltRecords} />
        <TestEvidenceCloseoutPanel tests={props.testRecords} />
        <PunchCloseoutPanel punchItems={props.punchItems} deficiencies={props.qualityDeficiencies} />
        <CommercialCloseoutPanel changeEvents={props.changeEvents} payApplications={props.payApplications} />
        <RetainageReleasePanel payApplications={props.payApplications} lienWaivers={props.lienWaivers} />
        <ArchivePackagePanel requirements={props.requirements} warranties={props.warrantyRecords} />
      </div>
    </>
  );
}
