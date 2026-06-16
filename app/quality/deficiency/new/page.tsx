import Link from "next/link";
import { DeficiencyWizard } from "@/components/d5o/quality/DeficiencyWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";
import { projects, qualityInspections, workPackages } from "@/lib/d5o/seed-data";

export const metadata = {
  title: "New Deficiency / Punch Item | RybexOS"
};

export default function NewDeficiencyPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Quality Recovery</p>
          <h1>New Deficiency / Punch Item</h1>
          <p>Assign correction, verification, closeout, billing, and acceptance impact before issues age into rework or payment risk.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/quality">Quality</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="quality_control" />
      <DeficiencyWizard projects={projects} workPackages={workPackages} inspections={qualityInspections} />
    </div>
  );
}
