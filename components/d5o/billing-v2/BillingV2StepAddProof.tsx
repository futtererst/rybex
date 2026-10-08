import type { ChangeEvent } from "react";
import type { BillingBackupPackage } from "@/lib/d5o/billing-v2";

type LocalDemoAttachment = {
  fileName: string;
  fileSize: number;
  fileType: string;
};

type BillingV2StepAddProofProps = {
  attachments: Record<string, LocalDemoAttachment>;
  billingPackage: BillingBackupPackage;
  feedback: string | null;
  referenceDrafts: Record<string, string>;
  waiverDrafts: Record<string, string>;
  onAttachLocalFile: (requirementId: string, event: ChangeEvent<HTMLInputElement>) => void;
  onReferenceDraftChange: (requirementId: string, value: string) => void;
  onSaveReference: (requirementId: string) => void;
  onValidateReadiness: () => void;
  onWaive: (requirementId: string) => void;
  onWaiverDraftChange: (requirementId: string, value: string) => void;
};

export function BillingV2StepAddProof({
  attachments,
  billingPackage,
  feedback,
  referenceDrafts,
  waiverDrafts,
  onAttachLocalFile,
  onReferenceDraftChange,
  onSaveReference,
  onValidateReadiness,
  onWaive,
  onWaiverDraftChange
}: BillingV2StepAddProofProps) {
  const requiredItems = billingPackage.evidenceRequirements.filter((requirement) => requirement.required);
  const completeCount = requiredItems.filter((requirement) =>
    ["referenced", "attached", "verified", "waived"].includes(requirement.status)
  ).length;
  const currentRequirement = requiredItems.find((requirement) => requirement.status === "missing") ?? requiredItems[0];
  const currentAttachment = currentRequirement ? attachments[currentRequirement.id] : undefined;
  const proofComplete = completeCount === requiredItems.length;

  return (
    <div data-qa="billing-v2-step-add-proof">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Add required proof</p>
          <h2>Assemble the evidence package</h2>
          <p>Each proof item must be referenced, attached, verified, or waived with a reason before review.</p>
        </div>
        <span className="chip chip-info">{completeCount} of {requiredItems.length} complete</span>
      </div>
      {!proofComplete && currentRequirement ? (
        <article className="guided-step-card" data-qa={`billing-v2-evidence-card-${currentRequirement.id}`}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current proof needed</p>
              <h3>{currentRequirement.label}</h3>
              <p>{currentRequirement.whyItMatters}</p>
            </div>
            <span className="chip chip-warning">missing</span>
          </div>
          <label className="form-field-wide">
            <span>Evidence reference</span>
            <textarea
              data-qa={`billing-v2-add-reference-${currentRequirement.id}`}
              onChange={(event) => onReferenceDraftChange(currentRequirement.id, event.target.value)}
              placeholder={`Where can the reviewer find ${currentRequirement.label.toLowerCase()}?`}
              value={referenceDrafts[currentRequirement.id] ?? ""}
            />
          </label>
          {currentRequirement.waiverAllowed ? (
            <details className="guided-supporting-details">
              <summary>Waive this proof instead</summary>
              <label className="form-field-wide">
                <span>Waiver reason</span>
                <textarea
                  onChange={(event) => onWaiverDraftChange(currentRequirement.id, event.target.value)}
                  placeholder={`Why can ${currentRequirement.label} be waived for this package?`}
                  value={waiverDrafts[currentRequirement.id] ?? ""}
                />
              </label>
              <button className="button button-secondary" onClick={() => onWaive(currentRequirement.id)} type="button">
                Waive with reason
              </button>
            </details>
          ) : null}
          <details className="guided-supporting-details">
            <summary>Attach a file reference</summary>
            <label>
              <span>File reference</span>
              <input
                data-qa={`billing-v2-attach-local-file-${currentRequirement.id}`}
                onChange={(event) => onAttachLocalFile(currentRequirement.id, event)}
                type="file"
              />
            </label>
            {currentAttachment ? (
              <p><strong>Selected:</strong> {currentAttachment.fileName}</p>
            ) : null}
          </details>
          <button className="button button-primary" onClick={() => onSaveReference(currentRequirement.id)} type="button">
            Save reference
          </button>
        </article>
      ) : (
        <section className="ready-callout">
          <strong>Evidence complete.</strong>
          <span> Validate the package readiness to request commercial review.</span>
        </section>
      )}
      <div className="focused-task-next">
        <span>What unlocks next</span>
        <strong>A complete proof package unlocks commercial review handoff.</strong>
      </div>
      {feedback ? <p className="missing-callout">{feedback}</p> : null}
      <details className="guided-supporting-details" data-qa="billing-v2-evidence-package">
        <summary>Evidence package status</summary>
        <ul className="plain-list">
          {requiredItems.map((requirement) => (
            <li key={requirement.id}>
              <strong>{requirement.label}</strong>
              <span> · {requirement.status.replaceAll("_", " ")}</span>
              {requirement.reference ? <span> · {requirement.reference.referenceText}</span> : null}
              {requirement.waiverReason ? <span> · waived: {requirement.waiverReason}</span> : null}
            </li>
          ))}
        </ul>
      </details>
      {!proofComplete ? (
        <p className="missing-callout">Add all required evidence before sending for review.</p>
      ) : null}
      <button className="button button-primary" data-qa="billing-v2-validate-readiness" disabled={!proofComplete} onClick={onValidateReadiness} type="button">
        Validate package readiness
      </button>
    </div>
  );
}
