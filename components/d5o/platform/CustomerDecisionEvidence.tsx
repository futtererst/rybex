"use client";

import { useState } from "react";

export type CustomerEvidencePurpose = "package-acceptance" | "work-acceptance" | "service-authorization";

export function CustomerDecisionEvidence({ workspace, workId, purpose, scopeId, evidenceId, onEvidence, disabled = false }: {
  workspace: string; workId: string; purpose: CustomerEvidencePurpose; scopeId: string;
  evidenceId: string; onEvidence: (id: string) => void; disabled?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = `/api/d5o-hosted/customer-decision-evidence?workspace=${encodeURIComponent(workspace)}`;
  async function upload() {
    if (!file || !scopeId) return;
    setBusy(true); setMessage(""); onEvidence("");
    try {
      const form = new FormData();
      form.set("file", file); form.set("workId", workId);
      form.set("purpose", purpose); form.set("scopeId", scopeId);
      const response = await fetch(endpoint, { method: "POST", body: form });
      const result = await response.json() as { evidenceId?: string; error?: string };
      if (!response.ok || !result.evidenceId) throw new Error(result.error ?? "Upload failed");
      onEvidence(result.evidenceId);
      setMessage("Signed PDF retained for this exact decision scope. Review it before recording the decision.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed"); }
    finally { setBusy(false); }
  }
  return <div>
    <label>Externally signed acceptance PDF
      <input type="file" accept="application/pdf" onChange={(event) => { setFile(event.target.files?.[0] ?? null); onEvidence(""); }} disabled={disabled || busy} />
    </label>
    <button type="button" onClick={() => void upload()} disabled={disabled || busy || !file || !scopeId}>
      {busy ? "Saving PDF…" : "Retain signed PDF"}
    </button>
    {evidenceId ? <a href={`${endpoint}&workId=${encodeURIComponent(workId)}&evidenceId=${encodeURIComponent(evidenceId)}`} target="_blank" rel="noreferrer">Open retained signed PDF</a> : null}
    {message ? <small role="status">{message}</small> : null}
  </div>;
}
