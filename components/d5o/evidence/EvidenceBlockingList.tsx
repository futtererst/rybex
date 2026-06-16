import Link from "next/link";
import type { EvidenceRequirement } from "@/lib/d5o/evidence/types";
import { EvidenceStatusChip } from "./EvidenceStatusChip";

type EvidenceBlockingListProps = {
  title?: string;
  requirements: EvidenceRequirement[];
  href?: string;
};

export function EvidenceBlockingList({ title = "Evidence blocking movement", requirements, href }: EvidenceBlockingListProps) {
  const visible = requirements.slice(0, 5);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Evidence Blockers</p>
          <h2>{title}</h2>
        </div>
        {href ? <Link className="button button-secondary" href={href}>Review evidence</Link> : null}
      </div>
      {visible.length > 0 ? (
        <div className="readiness-table">
          {visible.map((item) => (
            <div className="readiness-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.nextAction}</p>
              </div>
              <div>
                <EvidenceStatusChip status={item.status} />
                <p>{item.owner}</p>
              </div>
              <div>
                <p>{item.requiredForGate ? "Gate" : item.requiredForBilling ? "Billing" : item.requiredForCloseout ? "Closeout" : "Record"} movement blocked</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No evidence blockers in this view.</p>
      )}
    </section>
  );
}
