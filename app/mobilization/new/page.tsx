import Link from "next/link";
import { MobilizationPlanWizard } from "@/components/d5o/mobilization/MobilizationPlanWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Mobilization Plan | RybexOS"
};

export default function NewMobilizationPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">D3 Mobilization Setup</p>
          <h1>New Mobilization Plan</h1>
          <p>
            Convert a D2-ready project into a controlled field-start plan with
            safety, access, materials, quality, and work packages ready.
          </p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/mobilization">
            Back to Mobilization
          </Link>
          <Link className="button button-secondary" href="/command-center">
            Command Center
          </Link>
        </div>
      </header>

      <RoleContextBand workflowType="mobilization_readiness" />

      <section className="pipeline-guardrail">
        <strong>D3 setup rule:</strong>
        <span>
          Field start approval requires confirmed safety package, access, permits,
          locates, materials, crew, equipment, quality plan, kickoff, and field-ready work packages.
        </span>
      </section>

      <MobilizationPlanWizard />
    </div>
  );
}
