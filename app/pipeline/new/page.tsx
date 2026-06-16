import Link from "next/link";
import { OpportunityIntakeForm } from "@/components/d5o/OpportunityIntakeForm";
import { RoleContextBand } from "@/components/d5o/workflow/RoleContextBand";

export const metadata = {
  title: "New Opportunity | RybexOS"
};

export default function NewOpportunityPage() {
  return (
    <div className="command-grid">
      <header className="page-header">
        <div>
          <p className="page-kicker">D1 Discover Intake</p>
          <h1>New Opportunity</h1>
          <p>
            Capture the facts, documents, fit review, risk posture, and pursuit
            decision before estimating resources are committed.
          </p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/pipeline">
            Back to Pipeline
          </Link>
          <Link className="button button-secondary" href="/command-center">
            Command Center
          </Link>
        </div>
      </header>

      <RoleContextBand workflowType="pursuit_control" />

      <section className="pipeline-guardrail">
        <strong>Intake rule:</strong>
        <span>
          This guided form is a local demo workflow. It is structured for future
          persistence, approval routing, and promotion into D2 Define.
        </span>
      </section>

      <OpportunityIntakeForm />
    </div>
  );
}
