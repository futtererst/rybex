import Link from "next/link";
import type { EvidenceRequirement } from "@/lib/d5o/evidence/types";

type EvidenceRequiredPanelProps = {
  evidenceItems: EvidenceRequirement[];
};

function blocks(item: EvidenceRequirement) {
  const labels = [];
  if (item.requiredForGate) labels.push("gate");
  if (item.requiredForBilling) labels.push("billing");
  if (item.requiredForCloseout) labels.push("closeout");
  if (item.requiredForChangeRecovery) labels.push("change recovery");
  return labels.length > 0 ? labels.join(", ") : "workflow";
}

export function EvidenceRequiredPanel({ evidenceItems }: EvidenceRequiredPanelProps) {
  return (
    <section className="simplified-panel">
      <div className="simplified-panel-heading">
        <p className="eyebrow">Evidence needed</p>
        <h3>Required proof</h3>
      </div>
      {evidenceItems.length > 0 ? (
        <ul className="evidence-mini-list">
          {evidenceItems.slice(0, 4).map((item) => (
            <li key={item.id}>
              <span className={`artifact-state artifact-${item.status === "verified" || item.status === "waived" ? "complete" : item.status === "uploaded" ? "pending" : "missing"}`} />
              <span>
                <strong>{item.title}</strong>
                <small>Blocks: {blocks(item)}. Owner: {item.owner}. Due: {item.dueDate ?? "No due date"}.</small>
              </span>
              <span className="chip chip-info">{item.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No blocking evidence surfaced for this page.</p>
      )}
      <Link className="quiet-link" href="#details-records">View all evidence and records</Link>
    </section>
  );
}
