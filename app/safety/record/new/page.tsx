import Link from "next/link";
import { SafetyRecordWizard } from "@/components/d5o/safety/SafetyRecordWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";
import { projects, workPackages } from "@/lib/d5o/seed-data";

export const metadata = {
  title: "New Safety Record | RybexOS"
};

export default function NewSafetyRecordPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Safety Control</p>
          <h1>New Safety Record</h1>
          <p>Capture observations, near misses, incidents, and corrective actions before risk follows the crew into the next shift.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/safety">Safety</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="safety_control" />
      <SafetyRecordWizard projects={projects} workPackages={workPackages} />
    </div>
  );
}
