import type { DerivedEvidenceSummary } from "@/lib/d5o/evidence/types";

type EvidenceSummaryCardProps = {
  summary: DerivedEvidenceSummary;
};

export function EvidenceSummaryCard({ summary }: EvidenceSummaryCardProps) {
  return (
    <section className="evidence-summary-card">
      <div>
        <p className="eyebrow">Evidence Control</p>
        <h2>Proof required before movement</h2>
      </div>
      <div className="stage-gate-quick-grid">
        <EvidenceFact label="Missing" value={summary.missingEvidence.length} />
        <EvidenceFact label="Gate blockers" value={summary.evidenceBlockingGate.length} />
        <EvidenceFact label="Billing blockers" value={summary.evidenceBlockingBilling.length} />
        <EvidenceFact label="Closeout blockers" value={summary.evidenceBlockingCloseout.length} />
        <EvidenceFact label="Ready review" value={summary.evidenceReadyForReview.length} />
      </div>
    </section>
  );
}

function EvidenceFact({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
