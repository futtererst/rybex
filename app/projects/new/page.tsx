import Link from "next/link";
import { ProjectSetupWizard } from "@/components/d5o/projects/ProjectSetupWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Project Setup | RybexOS"
};

export default function NewProjectSetupPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">D2 Define Setup</p>
          <h1>New Project Setup</h1>
          <p>
            Convert approved pursuit or awarded work into a controlled subcontract
            baseline before mobilization planning begins.
          </p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/projects">
            Back to Projects
          </Link>
          <Link className="button button-secondary" href="/command-center">
            Command Center
          </Link>
        </div>
      </header>

      <RoleContextBand workflowType="contract_baseline" />

      <section className="pipeline-guardrail">
        <strong>D2 setup rule:</strong>
        <span>
          Field planning should not inherit unclear scope, unreviewed flow-downs,
          missing notice windows, or unapproved budget and schedule baselines.
        </span>
      </section>

      <ProjectSetupWizard />
    </div>
  );
}
