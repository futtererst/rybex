import Link from "next/link";
import { JhaToolboxWizard } from "@/components/d5o/safety/JhaToolboxWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";
import { projects, workPackages } from "@/lib/d5o/seed-data";

export const metadata = {
  title: "New JHA / Toolbox Talk | RybexOS"
};

export default function NewJhaPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Safety Readiness</p>
          <h1>New JHA / Toolbox Talk</h1>
          <p>Confirm hazards, controls, PPE, competent-person needs, emergency expectations, and crew acknowledgement before work starts.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/safety">Safety</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="safety_control" />
      <JhaToolboxWizard projects={projects} workPackages={workPackages} />
    </div>
  );
}
