import Link from "next/link";
import { PayApplicationWizard } from "@/components/d5o/billing/PayApplicationWizard";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Pay Application | RybexOS"
};

export default function NewPayApplicationPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">Pay Application Setup</p>
          <h1>New Pay Application</h1>
          <p>Build a controlled pay application from SOV progress, approved changes, field quantities, backup, retainage, and lien waivers.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/billing">Billing</Link>
          <Link className="button button-secondary" href="/command-center">Command Center</Link>
        </div>
      </header>

      <RoleContextBand workflowType="billing_cash_control" />

      <section className="pipeline-guardrail">
        <strong>Pay app rule:</strong>
        <span>Daily reports and quantity records support billing entitlement and reduce rejection risk.</span>
      </section>

      <PayApplicationWizard />
    </div>
  );
}
