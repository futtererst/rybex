"use client";

import { useEffect, useState } from "react";
import type { TriagePreflightResult } from "@/lib/d5o/discover/triage-preflight";
import type { TriageCommandResult } from "@/lib/d5o/discover/triage-transfer";
import styles from "./DiscoverDraftCollection.module.css";

const blockerLabel: Record<string, string> = {
  not_intake_draft: "This Work record is no longer an intake draft.",
  account_site_link_required: "Confirm a current account and site link.",
  source_required: "Record how this opportunity arrived.",
  source_reference_required: "Record a reference for the opportunity source.",
  work_type_required: "Choose the potential work type.",
  response_due_required: "Record the response deadline.",
  customer_need_required: "Describe the customer need.",
  triage_owner_required: "Assign an active commercial triage owner.",
  possible_existing_work: "A possible existing Work record needs scoped review.",
  independent_duplicate_disposition_not_commissioned: "An independent duplicate ruling is not yet commissioned.",
  independent_duplicate_review_required: "A current independent duplicate review is required for this Work version. An edit makes the earlier review stale; switch to the reviewer identity and review this exact Work before submitting.",
  legacy_match_requires_source_review: "A possible legacy opportunity needs source review before triage.",
  triage_owner_routing_not_commissioned: "The commercial triage routing rule is not yet commissioned.",
  triage_submission_not_commissioned: "Triage submission is not yet commissioned.",
};

export function DiscoverTriagePreflight({ workId, recordVersion, load, submit, onSubmitted }: {
  workId: string; recordVersion: number;
  load: (workId: string) => Promise<TriagePreflightResult>;
  submit: (workId: string, version: number, commandId: string) => Promise<TriageCommandResult>;
  onSubmitted: () => void;
}) {
  const [result, setResult] = useState<TriagePreflightResult | null>(null);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<TriageCommandResult | null>(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(workId).then(value => { if (active) setResult(value); })
      .catch(() => { if (active) setResult({ status: "unavailable" }); }); });
    return () => { active = false; };
  }, [load, workId, recordVersion]);
  const value = result?.status === "ok" ? result.value : null;
  return <section className={styles.preflight} aria-label="Triage readiness">
    <div className={styles.preflightHead}><h3>Triage readiness</h3><span>{value?.blockers.length === 0 ? "Ready for submission" : "Blocked"}</span></div>
    <p>Submission freezes the current Work version and independent review for the proposed owner. It does not qualify the opportunity or authorize spending. The server rechecks every condition.</p>
    {result === null ? <p role="status">Checking this Work record…</p> : null}
    {result?.status === "denied" ? <p role="alert">Readiness is no longer available to this identity.</p> : null}
    {result?.status === "unavailable" ? <p role="alert">Readiness could not be checked. Triage remains blocked.</p> : null}
    {value?.facts.duplicateReviewCurrent ? <p className={styles.reviewDone}>Independent distinctness review is current for this Work version.</p> : null}
    {value ? <ul>{value.blockers.map(key => <li key={key}>{blockerLabel[key]}</li>)}</ul> : null}
    {value?.blockers.length === 0 ? <button type="button" className={styles.primary} disabled={busy || outcome?.status === "completed"}
      onClick={() => {
        const id = commandId ?? crypto.randomUUID();
        setCommandId(id); setBusy(true); setOutcome(null);
        void submit(workId, value.recordVersion, id).then(next => {
          setOutcome(next);
          if (next.status === "completed") onSubmitted();
          else if (next.status !== "unknown_outcome") setCommandId(null);
        }).catch(() => setOutcome({ status: "unknown_outcome", retrySameCommand: true }))
          .finally(() => setBusy(false));
      }}>{busy ? "Submitting…" : commandId ? "Retry same submission" : "Submit to proposed owner"}</button> : null}
    {outcome?.status === "completed" ? <p role="status">Submitted. The proposed owner must still accept or return the assignment.</p> : null}
    {outcome?.status === "unknown_outcome" ? <p role="alert">The result is uncertain. Retry with the same command; do not create another submission.</p> : null}
    {outcome && "message" in outcome ? <p role="alert">{outcome.message}</p> : null}
  </section>;
}
