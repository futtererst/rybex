"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CorrectionContextResult } from "@/lib/d5o/discover/duplicate-correction";
import { trialCorrectionContext, trialCorrectSameWork } from "./actions";
import styles from "./DiscoverCorrectionWorkspace.module.css";

type Pending = {
  commandId: string; workId: string; retainedWorkId: string;
  expectedVersion: number; expectedRetainedVersion: number;
  expectedPriorReviewVersion: number; candidateWorkIds: string[]; reason: string;
};

export function DiscoverCorrectionWorkspace({ workspaceId, workId }: { workspaceId: string; workId: string }) {
  const [context, setContext] = useState<CorrectionContextResult | null>(null);
  const [retainedWorkId, setRetainedWorkId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [saved, setSaved] = useState<{ workId: string; retainedWorkId: string; recordVersion: number; reason: string } | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      void trialCorrectionContext(workspaceId, workId)
        .then(result => { if (active) setContext(result); })
        .catch(() => { if (active) setContext({ status: "unavailable" }); });
    });
    return () => { active = false; };
  }, [workspaceId, workId]);

  const value = context?.status === "ok" ? context.value : null;
  const retained = value?.candidates.find(candidate => candidate.workId === retainedWorkId && candidate.eligibleRetained);
  const reasonWordCount = reason.trim() ? reason.trim().split(/\s+/).length : 0;
  const canCorrect = !!value && !!retained && !value.tooManyCandidates
    && reason.trim().length >= 20 && reasonWordCount >= 8 && !busy;

  async function submit(retry = false) {
    if (!value || busy) return;
    const command = retry && pending ? pending : retained ? {
      commandId: `discover-correct-same-${crypto.randomUUID()}`,
      workId: value.workId, retainedWorkId: retained.workId,
      expectedVersion: value.recordVersion, expectedRetainedVersion: retained.recordVersion,
      expectedPriorReviewVersion: value.priorReviewedVersion,
      candidateWorkIds: value.candidateIds, reason: reason.trim(),
    } : null;
    if (!command) return;
    setPending(command); setBusy(true); setFeedback("");
    try {
      const result = await trialCorrectSameWork(workspaceId, command);
      if (result.status === "saved") {
        setPending(null);
        setSaved({ workId: result.workId, retainedWorkId: result.retainedWorkId,
          recordVersion: result.recordVersion, reason: command.reason });
      } else if (result.status === "unknown_outcome") {
        setFeedback("The outcome is unknown. Retry this exact command to check its receipt.");
      } else { setPending(null); setFeedback(result.message); }
    } catch { setFeedback("The outcome is unknown. Retry this exact command to check its receipt."); }
    finally { setBusy(false); }
  }

  return <main className={styles.main}>
    <nav className={styles.nav}><Link href="/discover-trial">Discover opportunities</Link><span>/</span>
      <strong>Prior-ruling correction</strong><Link href="/auth/sign-out">Switch trial identity</Link></nav>
    <header><p className={styles.eyebrow}>Discover / commercial decision</p><h1>Correct a prior duplicate ruling</h1>
      <p>A separate verified reviewer can close a later Work as the same opportunity. The earlier ruling and any owner return remain in its history.</p></header>
    {saved ? <section className={styles.success} role="status"><h2>Correction recorded</h2>
      <p>Work {saved.workId} is closed as historical same work at version {saved.recordVersion}. Continue on retained Work {saved.retainedWorkId}.</p>
      <h3>Recorded reason</h3><p>{saved.reason}</p>
      <p>The earlier distinct ruling and returned owner handoff remain in the audit history. This action did not submit triage, qualify pursuit, or authorize spending.</p>
      <Link href="/discover-trial">Return to Discover opportunities</Link></section> : null}
    {!saved && context === null ? <p role="status">Loading correction basis…</p> : null}
    {!saved && context?.status === "denied" ? <section className={styles.block} role="alert"><h2>Correction access unavailable</h2>
      <p>This action requires a verified employee with an explicit correction grant who is neither the capture author nor the original distinct reviewer.</p>
      <Link href="/auth/sign-out">Switch trial identity</Link></section> : null}
    {!saved && context?.status === "unavailable" ? <p className={styles.block} role="alert">The correction basis could not be loaded. Reopen the Work and try again.</p> : null}
    {!saved && value ? <div className={styles.layout}>
      <section className={styles.card}><p className={styles.eyebrow}>Later Work · {value.workId} · version {value.recordVersion}</p>
        <h2>{value.title}</h2><p className={styles.muted}>{value.customerContext || "Customer provisional"} / {value.siteContext || "Site provisional"}</p>
        <h3>Customer need</h3><p>{value.needSummary || "No need recorded"}</p>
        <div className={styles.prior}><strong>Earlier distinct ruling · Work version {value.priorReviewedVersion}</strong>
          <p>{value.priorReason}</p></div>
        <p className={styles.history}>{value.returnedSubmissionCount} returned owner {value.returnedSubmissionCount === 1 ? "handoff" : "handoffs"} will remain in the historical Work.</p>
      </section>
      <section className={styles.card}><h2>Choose the Work that should continue</h2>
        <p className={styles.muted}>Only an active intake draft linked to the same registered account and site can be retained. Compare the customer outcome and scope before choosing.</p>
        {value.tooManyCandidates ? <p className={styles.block} role="alert">This candidate set exceeds the bounded correction. Escalate instead of deciding here.</p> : null}
        <div className={styles.candidates}>{value.candidates.map(candidate => <label key={candidate.workId}
          className={`${styles.candidate} ${retainedWorkId === candidate.workId ? styles.selected : ""}`}>
          <input type="radio" name="retained-work" value={candidate.workId} checked={retainedWorkId === candidate.workId}
            disabled={!candidate.eligibleRetained || busy || !!pending || value.tooManyCandidates}
            onChange={() => setRetainedWorkId(candidate.workId)} />
          <span><strong>{candidate.title}</strong><small>{candidate.customerContext || "Customer provisional"} / {candidate.siteContext || "Site provisional"}</small>
            <span>{candidate.needSummary || "No need recorded"}</span><small>Work {candidate.workId} · version {candidate.recordVersion}</small>
            <em>{candidate.eligibleRetained ? "Eligible to retain" : candidate.accountId !== value.accountId || candidate.siteId !== value.siteId
              ? "Different registered account or site" : `Unavailable · ${candidate.lifecycleState}`}</em></span>
        </label>)}</div>
        <label className={styles.reason}>Why was the earlier distinct ruling wrong, and why should the selected Work continue?
          <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={5}
            disabled={busy || !!pending} placeholder="Describe the shared customer outcome and scope, cite the retained Work, and explain the earlier mistake in at least eight words." /></label>
        <p className={styles.hint} role="status">{!retained ? "Select an eligible retained Work."
          : reason.trim().length < 20 || reasonWordCount < 8 ? "Explain the correction in at least eight words and 20 characters."
          : "Ready to record. The later Work will close; prior decisions and returned handoffs remain historical."}</p>
        {feedback ? <p className={styles.block} role="alert">{feedback}</p> : null}
        <button type="button" className={styles.primary} disabled={!canCorrect && !pending}
          onClick={() => void submit(!!pending)}>{busy ? "Recording…" : pending ? "Retry same correction" : "Record same-work correction"}</button>
      </section>
    </div> : null}
  </main>;
}
