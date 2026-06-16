"use client";

import { useState } from "react";
import { useLocalEvidenceStore } from "@/lib/d5o/evidence/local-evidence-store";

export function EvidenceReset() {
  const { resetEvidenceState } = useLocalEvidenceStore();
  const [message, setMessage] = useState("");

  return (
    <div className="button-row">
      <button
        className="button button-secondary"
        onClick={() => {
          resetEvidenceState();
          setMessage("Demo evidence state reset.");
        }}
        type="button"
      >
        Reset demo evidence state
      </button>
      {message ? <span className="muted">{message}</span> : null}
    </div>
  );
}
