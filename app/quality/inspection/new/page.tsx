import Link from "next/link";
import { QualityInspectionWizard } from "@/components/d5o/quality/QualityInspectionWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";
import { projects, workPackages } from "@/lib/d5o/seed-data";

export const metadata = {
  title: "New Quality Inspection | RybexOS"
};

export default function NewQualityInspectionPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Quality Control</p>
          <h1>New Inspection</h1>
          <p>Document acceptance criteria, inspection results, photos, and tests while the work is still visible.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/quality">Quality</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="quality_control" />
      <QualityInspectionWizard projects={projects} workPackages={workPackages} />
    </div>
  );
}
