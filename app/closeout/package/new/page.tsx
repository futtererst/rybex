import Link from "next/link";
import { CloseoutPackageWizard } from "@/components/d5o/closeout/CloseoutPackageWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Closeout Package | RybexOS"
};

export default function NewCloseoutPackagePage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">D5 Acceptance Package</p>
          <h1>New Closeout Package</h1>
          <p>Assemble the proof required for acceptance, final billing, retainage release, and archive-quality handoff.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/closeout">Closeout</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="closeout_acceptance" />
      <CloseoutPackageWizard />
    </div>
  );
}
