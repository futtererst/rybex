import Link from "next/link";
import { SubmittalWizard } from "@/components/d5o/rfis-submittals/SubmittalWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Submittal | RybexOS"
};

export default function NewSubmittalPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Approval Package Control</p>
          <h1>New Submittal</h1>
          <p>Create a controlled submittal package before materials, methods, testing, or closeout evidence block work.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/rfis-submittals">RFIs &amp; Submittals</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="information_control" />
      <SubmittalWizard />
    </div>
  );
}
