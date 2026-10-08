export type BillingV2StepStatus = "not_started" | "active" | "complete" | "blocked";

export type BillingV2RailStep = {
  id: string;
  label: string;
  status: BillingV2StepStatus;
};

type BillingV2ProcessRailProps = {
  steps: BillingV2RailStep[];
};

function statusLabel(status: BillingV2StepStatus) {
  if (status === "not_started") return "Not started";
  return status.replaceAll("_", " ");
}

export function BillingV2ProcessRail({ steps }: BillingV2ProcessRailProps) {
  return (
    <nav className="panel" aria-label="Billing v2 process steps" data-qa="billing-v2-process-rail">
      <p className="eyebrow">Process rail</p>
      <ol className="plain-list">
        {steps.map((step, index) => (
          <li key={step.id} style={{ display: "grid", gap: "0.35rem", padding: "0.65rem 0" }}>
            <span className={`chip chip-${step.status === "complete" ? "success" : step.status === "blocked" ? "critical" : step.status === "active" ? "warning" : "info"}`}>
              Step {index + 1}
            </span>
            <strong>{step.label}</strong>
            <span className="muted">{statusLabel(step.status)}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
