import { StatusChip } from "@/components/d5o/StatusChip";
import { dateLabel } from "@/lib/d5o/presentation";

type EvidenceChecklistItem = {
  id: string;
  title: string;
  required?: boolean;
  status: "missing" | "partial" | "complete" | "verified" | "pending" | "uploaded" | "under_review" | "rejected" | "waived" | "not_required";
  owner?: string;
  dueDate?: string;
  source?: string;
};

type EvidenceChecklistProps = {
  title?: string;
  items: EvidenceChecklistItem[];
};

const toneByStatus: Record<EvidenceChecklistItem["status"], "critical" | "warning" | "success" | "info" | "neutral"> = {
  missing: "critical",
  partial: "warning",
  complete: "success",
  verified: "success",
  pending: "info",
  uploaded: "info",
  under_review: "warning",
  rejected: "critical",
  waived: "neutral",
  not_required: "neutral"
};

export function EvidenceChecklist({ title = "Evidence checklist", items }: EvidenceChecklistProps) {
  return (
    <section className="evidence-checklist">
      <div className="compact-heading">
        <h3>{title}</h3>
        <span className="chip chip-neutral">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <span className={item.status === "complete" || item.status === "verified" ? "artifact-state artifact-complete" : "artifact-state artifact-missing"} />
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.required === false ? "Optional" : "Required"}
                  {item.owner ? ` · ${item.owner}` : ""}
                  {item.dueDate ? ` · ${dateLabel(item.dueDate)}` : ""}
                  {item.source ? ` · ${item.source}` : ""}
                </small>
              </div>
              <StatusChip label={item.status.replaceAll("_", " ")} tone={toneByStatus[item.status]} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No evidence requirements listed.</p>
      )}
    </section>
  );
}
