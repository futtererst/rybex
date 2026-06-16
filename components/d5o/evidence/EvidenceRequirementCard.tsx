"use client";

import { dateLabel } from "@/lib/d5o/presentation";
import { evidenceCategoryConfig } from "@/lib/d5o/evidence/config";
import { useLocalEvidenceStore } from "@/lib/d5o/evidence/local-evidence-store";
import type { EvidenceRequirement } from "@/lib/d5o/evidence/types";
import { EvidenceStatusChip } from "./EvidenceStatusChip";
import { EvidenceUploadStub } from "./EvidenceUploadStub";

type EvidenceRequirementCardProps = {
  requirement: EvidenceRequirement;
  compact?: boolean;
  showActions?: boolean;
};

export function EvidenceRequirementCard({ requirement, compact = false, showActions = true }: EvidenceRequirementCardProps) {
  const { applyEvidenceOverlay } = useLocalEvidenceStore();
  const item = applyEvidenceOverlay(requirement);
  const config = evidenceCategoryConfig[item.category];

  return (
    <article className={`evidence-requirement-card evidence-${item.status}${compact ? " evidence-compact" : ""}`}>
      <div className="workflow-card-header">
        <div>
          <p className="eyebrow">{config.shortLabel} evidence</p>
          <h3>{item.title}</h3>
        </div>
        <EvidenceStatusChip status={item.status} />
      </div>
      {!compact ? <p className="muted">{item.description}</p> : null}
      <div className="workflow-meta-row">
        <span><strong>Owner</strong>{item.owner}</span>
        <span><strong>Due</strong>{item.dueDate ? dateLabel(item.dueDate) : "No date"}</span>
        <span><strong>Required</strong>{requiredForLabel(item)}</span>
        <span><strong>Attachments</strong>{item.linkedAttachmentIds.length}</span>
      </div>
      <p><strong>Next:</strong> {item.nextAction}</p>
      {showActions ? <EvidenceUploadStub compact={compact} requirement={item} /> : null}
    </article>
  );
}

function requiredForLabel(item: EvidenceRequirement) {
  const labels = [
    item.requiredForGate ? "gate" : "",
    item.requiredForBilling ? "billing" : "",
    item.requiredForCloseout ? "closeout" : "",
    item.requiredForChangeRecovery ? "change" : ""
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(", ") : item.required ? "record" : "optional";
}
