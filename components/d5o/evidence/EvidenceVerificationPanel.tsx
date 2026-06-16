"use client";

import { useLocalEvidenceStore } from "@/lib/d5o/evidence/local-evidence-store";
import type { EvidenceRequirement } from "@/lib/d5o/evidence/types";
import { EvidenceRequirementCard } from "./EvidenceRequirementCard";

type EvidenceVerificationPanelProps = {
  requirements: EvidenceRequirement[];
};

export function EvidenceVerificationPanel({ requirements }: EvidenceVerificationPanelProps) {
  const { applyEvidenceOverlay } = useLocalEvidenceStore();
  const ready = requirements
    .map((item) => applyEvidenceOverlay(item))
    .filter((item) => item.status === "uploaded" || item.status === "under_review")
    .slice(0, 4);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Evidence Verification</p>
          <h2>Ready for review</h2>
        </div>
        <span className="muted">Production approval and storage are not enabled.</span>
      </div>
      {ready.length > 0 ? (
        <div className="operating-columns">
          {ready.map((item) => (
            <EvidenceRequirementCard compact key={item.id} requirement={item} />
          ))}
        </div>
      ) : (
        <p className="muted">No evidence is currently ready for review.</p>
      )}
    </section>
  );
}
