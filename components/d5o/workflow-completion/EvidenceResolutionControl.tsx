"use client";

import { useState } from "react";
import { useLocalEvidenceStore } from "@/lib/d5o/evidence/local-evidence-store";
import type { EvidenceRequirement } from "@/lib/d5o/evidence/types";
import type { WorkflowCompletionActionType, WorkflowCompletionItem } from "@/lib/d5o/workflow-completion/types";

type EvidenceResolutionControlProps = {
  item: WorkflowCompletionItem;
  requirements: EvidenceRequirement[];
  onCompletionAction: (actionType: WorkflowCompletionActionType, note?: string) => void;
};

export function EvidenceResolutionControl({ item, requirements, onCompletionAction }: EvidenceResolutionControlProps) {
  const { markEvidence, applyEvidenceOverlay } = useLocalEvidenceStore();
  const [waiverReason, setWaiverReason] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const activeRequirements = requirements.map((requirement) => applyEvidenceOverlay(requirement));

  function markAttached() {
    onCompletionAction("mark_evidence_attached", "Backup marked attached in local demo state.");
    requirements.forEach((requirement) =>
      markEvidence(requirement, "uploaded", "Marked attached from workflow completion proof.")
    );
  }

  function waiveEvidence() {
    if (waiverReason.trim().length < 4) {
      onCompletionAction("waive_evidence", waiverReason);
      return;
    }

    onCompletionAction("waive_evidence", waiverReason);
    requirements.forEach((requirement) =>
      markEvidence(requirement, "waived", waiverReason || "Waived from workflow completion proof.")
    );
  }

  return (
    <section className="completion-evidence" data-qa="completion-evidence">
      <div className="completion-section-heading">
        <div>
          <p className="eyebrow">Needed now</p>
          <h3>Evidence blocking billing</h3>
        </div>
        <span className="chip chip-warning" data-qa="evidence-completion-state">{item.status.replaceAll("_", " ")}</span>
      </div>

      <div className="completion-evidence-list">
        {activeRequirements.map((requirement) => (
          <article className="completion-evidence-item" data-qa="completion-evidence-item" key={requirement.id}>
            <div>
              <strong>{requirement.title}</strong>
              <span>{requirement.nextAction}</span>
            </div>
            <span className={`chip chip-${["uploaded", "verified", "waived"].includes(requirement.status) ? "success" : "warning"}`} data-qa="evidence-status">
              {requirement.status.replaceAll("_", " ")}
            </span>
          </article>
        ))}
      </div>

      <div className="completion-action-row">
        <button className="button button-primary" data-completion-action="mark_evidence_attached" data-qa="mark-backup-attached" onClick={markAttached} type="button">
          Mark backup attached
        </button>
        <button
          className="button button-secondary"
          onClick={() => setUploadMessage("Production upload is not enabled. Use demo attachment action.")}
          type="button"
        >
          Attach evidence
        </button>
      </div>

      <label className="completion-waiver">
        Waiver reason
        <textarea
          onChange={(event) => setWaiverReason(event.target.value)}
          placeholder="Example: GC accepted alternate backup for this pay application."
          value={waiverReason}
        />
      </label>
      <button className="button button-secondary" onClick={waiveEvidence} type="button">
        Waive evidence
      </button>

      {uploadMessage ? <p className="transaction-message">{uploadMessage}</p> : null}
    </section>
  );
}
