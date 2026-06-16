"use client";

import { dateLabel } from "@/lib/d5o/presentation";
import { useLocalEvidenceStore } from "@/lib/d5o/evidence/local-evidence-store";
import type { EvidenceRequirement } from "@/lib/d5o/evidence/types";
import { EvidenceStatusChip } from "./EvidenceStatusChip";

type EvidenceChecklistPanelProps = {
  title?: string;
  requirements: EvidenceRequirement[];
  limit?: number;
};

export function EvidenceChecklistPanel({ title = "Evidence checklist", requirements, limit = 6 }: EvidenceChecklistPanelProps) {
  const { applyEvidenceOverlay } = useLocalEvidenceStore();
  const visible = requirements.slice(0, limit).map((item) => applyEvidenceOverlay(item));

  return (
    <section className="evidence-checklist">
      <div className="compact-heading">
        <h3>{title}</h3>
        <span className="chip chip-neutral">{requirements.length}</span>
      </div>
      {visible.length > 0 ? (
        <ul>
          {visible.map((item) => (
            <li key={item.id}>
              <span className={item.status === "verified" || item.status === "waived" ? "artifact-state artifact-complete" : "artifact-state artifact-missing"} />
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.required ? "Required" : "Optional"}
                  {item.owner ? ` · ${item.owner}` : ""}
                  {item.dueDate ? ` · ${dateLabel(item.dueDate)}` : ""}
                  {item.sourceModule ? ` · ${item.sourceModule.replaceAll("_", " ")}` : ""}
                </small>
              </div>
              <EvidenceStatusChip status={item.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No evidence requirements listed.</p>
      )}
      {requirements.length > visible.length ? <p className="muted">{requirements.length - visible.length} more evidence item(s) in supporting records.</p> : null}
    </section>
  );
}
