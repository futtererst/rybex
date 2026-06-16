import Link from "next/link";
import { RfiWizard } from "@/components/d5o/rfis-submittals/RfiWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New RFI | RybexOS"
};

export default function NewRfiPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Formal Clarification</p>
          <h1>New RFI</h1>
          <p>Create a formal clarification record before field uncertainty becomes delay, rework, or unrecoverable scope.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/rfis-submittals">RFIs &amp; Submittals</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="information_control" />
      <RfiWizard />
    </div>
  );
}
