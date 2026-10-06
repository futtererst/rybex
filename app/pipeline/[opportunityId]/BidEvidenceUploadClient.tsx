"use client";

import { useState } from "react";
import type { BidSubmissionApprovalReadiness } from "@/lib/d5o/opportunities/types";

type EvidenceRequirement = BidSubmissionApprovalReadiness["missingEvidence"][number];

type BidEvidenceUploadClientProps = {
  requirements: EvidenceRequirement[];
  action: (formData: FormData) => void;
};

export function BidEvidenceUploadClient({ requirements, action }: BidEvidenceUploadClientProps) {
  const [hasValidFile, setHasValidFile] = useState(false);
  const relationshipType = requirements[0]?.relationshipType ?? "";

  return (
    <form action={action} className="pipeline-section pipeline-bid-evidence-form" data-main-correction="bid-evidence">
      <h3>Configured bid-package evidence</h3>
      {requirements.map((item) => (
        <div className="pursuit-risk-row" key={item.evidenceTypeKey}>
          <strong>{item.label}</strong>
          <span>Status: Missing</span>
        </div>
      ))}
      <input type="hidden" name="relationshipType" value={relationshipType} />
      <label className="pipeline-wide-field">
        Evidence file
        <input
          aria-describedby="bid-evidence-file-requirement"
          name="bidApprovalEvidenceDocument"
          type="file"
          required
          onChange={(event) => setHasValidFile(Boolean(event.currentTarget.files?.[0]?.size))}
        />
      </label>
      <small id="bid-evidence-file-requirement">Select a non-empty evidence file before saving. Notes cannot satisfy this requirement.</small>
      <label className="pipeline-wide-field">
        Evidence note
        <textarea name="evidenceNote" rows={3} placeholder="Describe the bid-package evidence being attached." />
      </label>
      <button className="button button-primary" type="submit" disabled={!hasValidFile || !relationshipType}>
        Save bid-package evidence
      </button>
    </form>
  );
}
