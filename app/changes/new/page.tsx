import Link from "next/link";
import { ChangeEventWizard } from "@/components/d5o/change-control/ChangeEventWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Change Event | RybexOS"
};

export default function NewChangeEventPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Notice and Recovery</p>
          <h1>New Change Event</h1>
          <p>Capture changed conditions, extra work, access delays, and GC direction before notice and recovery are missed.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/changes">Change Control</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>
      <RoleContextBand workflowType="change_recovery" />
      <ChangeEventWizard />
    </div>
  );
}
