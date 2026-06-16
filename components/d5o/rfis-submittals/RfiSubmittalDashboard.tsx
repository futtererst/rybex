import { InformationBlockerPanel } from "./InformationBlockerPanel";
import { RfiCard } from "./RfiCard";
import { RfiImpactPanel } from "./RfiImpactPanel";
import { RfiTable } from "./RfiTable";
import { SubmittalCard } from "./SubmittalCard";
import { SubmittalRegister } from "./SubmittalRegister";
import { SubmittalReviewPanel } from "./SubmittalReviewPanel";
import type { RFI, Submittal } from "@/lib/d5o/types";

export function RfiSubmittalDashboard({
  rfis,
  submittals
}: {
  rfis: RFI[];
  submittals: Submittal[];
}) {
  const urgentRfis = rfis.filter((rfi) =>
    rfi.status === "overdue" || rfi.priority === "critical" || rfi.scheduleImpact
  );
  const activeSubmittals = submittals.filter((submittal) =>
    !["approved", "approved_as_noted", "closed"].includes(submittal.status)
  );

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RFI Register</p>
            <h2>Project clarification and response control</h2>
          </div>
          <span className="muted">{rfis.length} RFIs</span>
        </div>
        <RfiTable rfis={rfis} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Submittal Register</p>
            <h2>Approval packages that affect field work</h2>
          </div>
          <span className="muted">{submittals.length} submittals</span>
        </div>
        <SubmittalRegister submittals={submittals} />
      </section>

      <div className="operating-columns">
        <InformationBlockerPanel rfis={rfis} submittals={submittals} />
        <RfiImpactPanel rfis={rfis} />
        <SubmittalReviewPanel submittals={submittals} />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Schedule-Critical RFIs</p>
            <h2>Clarifications that can stop or change field work</h2>
          </div>
        </div>
        <div className="project-detail-grid">
          {urgentRfis.map((rfi) => (
            <RfiCard key={rfi.id} rfi={rfi} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Active Submittals</p>
            <h2>Packages needing review, approval, or resubmission</h2>
          </div>
        </div>
        <div className="project-detail-grid">
          {activeSubmittals.map((submittal) => (
            <SubmittalCard key={submittal.id} submittal={submittal} />
          ))}
        </div>
      </section>
    </>
  );
}
