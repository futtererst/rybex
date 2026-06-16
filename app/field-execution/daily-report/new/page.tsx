import Link from "next/link";
import { DailyReportWizard } from "@/components/d5o/field-execution/DailyReportWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Daily Report | RybexOS"
};

export default function NewDailyReportPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">D4 Daily Field Control</p>
          <h1>New Daily Report</h1>
          <p>
            Capture crew, labor, equipment, quantities, safety, quality, delays,
            changed conditions, photos, tests, and supervisor signoff.
          </p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/field-execution">
            Back to Field Execution
          </Link>
          <Link className="button button-secondary" href="/command-center">
            Command Center
          </Link>
        </div>
      </header>

      <RoleContextBand workflowType="field_execution" />

      <section className="pipeline-guardrail">
        <strong>D4 daily report rule:</strong>
        <span>
          Changed conditions should be documented the day they occur to protect
          notice, change recovery, billing backup, and closeout evidence.
        </span>
      </section>

      <DailyReportWizard />
    </div>
  );
}
