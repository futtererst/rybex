"use client";

import { useRef, useState, useTransition } from "react";
import { uploadEvidenceAttachment } from "@/app/actions/evidence-uploads";
import { useLocalEvidenceStore } from "@/lib/d5o/evidence/local-evidence-store";
import type { EvidenceRequirement } from "@/lib/d5o/evidence/types";

type EvidenceUploadStubProps = {
  requirement: EvidenceRequirement;
  compact?: boolean;
};

export function EvidenceUploadStub({ requirement, compact = false }: EvidenceUploadStubProps) {
  const { markEvidence } = useLocalEvidenceStore();
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function mark(status: "uploaded" | "verified" | "waived") {
    markEvidence(requirement, status, `${status} in local demo evidence state.`);
    setMessage(status === "uploaded" ? "Marked attached in demo state." : status === "verified" ? "Marked verified in demo state." : "Marked waived in demo state.");
  }

  function uploadPilot() {
    if (!selectedFile) {
      setMessage("Choose a file before using the upload pilot.");
      return;
    }

    const formData = new FormData();
    formData.append("evidenceRequirementId", requirement.id);
    formData.append("file", selectedFile);

    startTransition(async () => {
      const result = await uploadEvidenceAttachment(formData);
      setMessage(result.message);

      if (result.success) {
        markEvidence(requirement, "uploaded", "Uploaded through database evidence pilot.");
        setSelectedFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    });
  }

  return (
    <div className={compact ? "evidence-demo-actions evidence-demo-actions-compact" : "evidence-demo-actions"}>
      <small>Local demo actions stay available. Upload pilot requires database evidence mode and private Supabase Storage.</small>
      {!compact ? (
        <div className="form-grid evidence-upload-grid">
          <label>
            Evidence file
            <input
              ref={fileInputRef}
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <button className="button button-secondary" disabled={isPending} onClick={uploadPilot} type="button">
            {isPending ? "Uploading..." : "Upload pilot"}
          </button>
          {selectedFile ? <small className="muted">{selectedFile.name} · {Math.ceil(selectedFile.size / 1024)} KB</small> : null}
        </div>
      ) : null}
      <div className="button-row">
        <button className="button button-secondary" onClick={() => mark("uploaded")} type="button">Mark attached</button>
        <button className="button button-secondary" onClick={() => mark("verified")} type="button">Verify</button>
        <button className="button button-secondary" onClick={() => mark("waived")} type="button">Waive</button>
      </div>
      {message ? <p className="transaction-message">{message}</p> : null}
    </div>
  );
}
