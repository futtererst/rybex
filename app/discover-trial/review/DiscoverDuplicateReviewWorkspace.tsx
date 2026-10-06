"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DuplicateReviewContextResult, DuplicateReviewItem, DuplicateReviewQueue } from "@/lib/d5o/discover/duplicate-review";
import { trialRecordDistinct, trialRecordSameWork, trialReviewContext, trialReviewQueue } from "./actions";
import styles from "./DiscoverDuplicateReviewWorkspace.module.css";

export function DiscoverDuplicateReviewWorkspace({ workspaceId }: { workspaceId: string }) {
  const [queue, setQueue] = useState<DuplicateReviewQueue | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [context, setContext] = useState<DuplicateReviewContextResult | null>(null);
  const [comparisons, setComparisons] = useState<Record<string, "different" | "same">>({});
  const [reason, setReason] = useState("");
  const [sameWorkId, setSameWorkId] = useState("");
  const [sameReason, setSameReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState<{ commandId: string; workId: string; expectedVersion: number;
    comparedWorkIds: string[]; reason: string } | null>(null);
  const [samePending, setSamePending] = useState<{ commandId: string; workId: string;
    retainedWorkId: string; expectedVersion: number; expectedRetainedVersion: number;
    candidateWorkIds: string[]; reason: string } | null>(null);
  const request = useRef(0);

  const refreshQueue = useCallback(async () => {
    try { setQueue(await trialReviewQueue(workspaceId)); }
    catch { setQueue({ status: "unavailable" }); }
  }, [workspaceId]);
  useEffect(() => { queueMicrotask(() => { void refreshQueue(); }); }, [refreshQueue]);

  async function open(workId: string) {
    const current = ++request.current;
    setSelected(workId); setContext(null); setComparisons({}); setReason(""); setSameWorkId(""); setSameReason("");
    setFeedback(""); setPending(null); setSamePending(null);
    try {
      const value = await trialReviewContext(workspaceId, workId);
      if (current === request.current) setContext(value);
    } catch { if (current === request.current) setContext({ status: "unavailable" }); }
  }

  async function decide(retry = false) {
    const value = context?.status === "ok" ? context.value : null;
    if (!value || busy) return;
    const command = retry && pending ? pending : {
      commandId: `discover-distinct-${crypto.randomUUID()}`,
      workId: value.workId, expectedVersion: value.recordVersion,
      comparedWorkIds: value.candidateIds, reason: reason.trim(),
    };
    setPending(command); setBusy(true); setFeedback("");
    try {
      const outcome = await trialRecordDistinct(workspaceId, command);
      if (outcome.status === "saved") {
        setPending(null); setComparisons({}); setReason("");
        setFeedback(`Distinct ruling recorded on Work ${outcome.workId}. The author must recheck triage readiness and submit separately.`);
        await refreshQueue();
        const updated = await trialReviewContext(workspaceId, outcome.workId);
        setContext(updated);
      } else if (outcome.status === "unknown_outcome") {
        setFeedback("Outcome unknown. Retry this exact review command to check its receipt.");
      } else { setPending(null); setFeedback(outcome.message); }
    } catch { setFeedback("Outcome unknown. Retry this exact review command to check its receipt."); }
    finally { setBusy(false); }
  }

  async function closeSameWork(retry = false) {
    const value = context?.status === "ok" ? context.value : null;
    if (!value || busy) return;
    const retained = value.candidates.find(candidate => candidate.workId === sameWorkId);
    const command = retry && samePending ? samePending : retained ? {
      commandId: `discover-same-work-${crypto.randomUUID()}`,
      workId: value.workId, retainedWorkId: retained.workId,
      expectedVersion: value.recordVersion, expectedRetainedVersion: retained.recordVersion,
      candidateWorkIds: value.candidateIds, reason: sameReason.trim(),
    } : null;
    if (!command) return;
    setSamePending(command); setBusy(true); setFeedback("");
    try {
      const outcome = await trialRecordSameWork(workspaceId, command);
      if (outcome.status === "saved") {
        setSamePending(null); setSelected(null); setContext(null);
        setQueue(previous => previous?.status === "ok"
          ? { status: "ok", items: previous.items.filter(item => item.workId !== outcome.workId) }
          : previous);
        await refreshQueue();
        setFeedback(`Work ${outcome.workId} is closed as historical same work. Continue on retained Work ${outcome.retainedWorkId}. Triage was not submitted.`);
      } else if (outcome.status === "unknown_outcome") {
        setFeedback("Outcome unknown. Retry this exact same-work command to check its receipt.");
      } else { setSamePending(null); setFeedback(outcome.message); }
    } catch { setFeedback("Outcome unknown. Retry this exact same-work command to check its receipt."); }
    finally { setBusy(false); }
  }

  const value = context?.status === "ok" ? context.value : null;
  const comparedCount = value?.candidateIds.filter(id => !!comparisons[id]).length ?? 0;
  const differentCount = value?.candidateIds.filter(id => comparisons[id] === "different").length ?? 0;
  const sameCount = value?.candidateIds.filter(id => comparisons[id] === "same").length ?? 0;
  const candidateCount = value?.candidateIds.length ?? 0;
  const allCompared = !!value && comparedCount === candidateCount;
  const allDifferent = allCompared && sameCount === 0;
  const currentReview = value?.reviewedVersion === value?.recordVersion;
  const canDecide = !!value && !value.selfReview && !value.legacyHold && !value.tooManyCandidates
    && !currentReview && allDifferent && reason.trim().length >= 20 && !busy && !samePending;
  const canCloseSameWork = !!value && !value.selfReview && !value.legacyHold && !value.tooManyCandidates
    && allCompared && sameCount > 0 && !!sameWorkId && comparisons[sameWorkId] === "same"
    && value.candidates.some(candidate => candidate.workId === sameWorkId)
    && sameReason.trim().length >= 20 && !busy && !pending;
  return <main className={styles.main}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Discover / commercial review</p>
      <h1>Duplicate review</h1><p>Compare current tenant-scoped opportunities. Keep a distinct need active, or close a later duplicate while retaining its history.</p></div>
      <nav><Link href="/discover-trial">Discover opportunities</Link> · <Link href="/auth/sign-out">Switch trial identity</Link></nav></header>
    <div className={styles.scope}><strong>Separate decision</strong><span>The capture author cannot rule on their own Work. A ruling does not submit triage, qualify pursuit or authorize spending.</span></div>
    {feedback ? <p role="status" className={styles.feedback}>{feedback}</p> : null}
    <div className={styles.layout}>
      <section className={styles.queue} aria-label="Duplicate review queue">
        <div className={styles.sectionHead}><h2>Linked intake drafts</h2><button type="button" onClick={() => void refreshQueue()}>Refresh</button></div>
        {queue === null ? <p role="status">Loading review queue…</p> : null}
        {queue?.status === "denied" ? <p role="alert">A current explicit duplicate-review right is required. No opportunities are shown.</p> : null}
        {queue?.status === "unavailable" ? <p role="alert">The review queue is unavailable. No decision can be made.</p> : null}
        {queue?.status === "ok" && !queue.items.length ? <p>No linked drafts are available for review in this workspace.</p> : null}
        {queue?.status === "ok" ? <div className={styles.rows}>{queue.items.map((item: DuplicateReviewItem) =>
          <button key={item.workId} type="button" className={selected === item.workId ? styles.selected : ""}
            onClick={() => void open(item.workId)}>
            <strong>{item.title}</strong><span>{item.customerContext || "Customer provisional"} / {item.siteContext || "Site provisional"}</span>
            <small>Work {item.workId} · version {item.recordVersion} · {item.reviewedVersion === item.recordVersion ? "review current" : "review needed"}</small>
          </button>)}</div> : null}
      </section>
      <section className={styles.detail} aria-label="Selected duplicate review">
        {!selected ? <div className={styles.empty}><h2>Select an opportunity</h2><p>Open a linked draft to inspect the current candidates and decision boundary.</p></div> : null}
        {selected && context === null ? <p role="status">Loading the current review context…</p> : null}
        {context?.status === "denied" ? <p role="alert">This Work record is unavailable to your current review authority.</p> : null}
        {context?.status === "unavailable" ? <p role="alert">The current comparison could not be loaded. Reopen the record before deciding.</p> : null}
        {value ? <>
          <p className={styles.eyebrow}>Work {value.workId} · version {value.recordVersion}</p><h2>{value.title}</h2>
          <p className={styles.context}>{value.customerContext || "Customer provisional"} / {value.siteContext || "Site provisional"}</p>
          <div className={styles.need}><strong>Customer need being reviewed</strong><p>{value.needSummary || "No customer need recorded"}</p>
            <small>Potential work type: {value.workType || "not specified"}</small></div>
          {value.selfReview ? <p className={styles.hold} role="alert">You captured this Work. A different authorized reviewer must decide.</p> : null}
          {value.legacyHold ? <p className={styles.hold} role="alert">A legacy opportunity may match. Source reconciliation is required before a distinct ruling.</p> : null}
          {value.tooManyCandidates ? <p className={styles.hold} role="alert">The candidate set exceeds this bounded review. Escalate instead of deciding here.</p> : null}
          {currentReview ? <section className={styles.recorded} aria-label="Recorded distinct ruling">
            <h3>Distinct ruling recorded</h3>
            <p>This decision covers the current Work version and {value.reviewedCandidateIds?.length ?? 0} possible matches. It did not submit the opportunity for triage.</p>
            <strong>Recorded reason</strong><p className={styles.recordedReason}>{value.reviewReason || "Reason unavailable"}</p>
            <small>Check the reason before the Work moves to triage. The ruling remains in the audit record; correcting a mistaken ruling needs a separate reviewed correction.</small>
          </section> : null}
          {value.reviewedVersion !== null && !currentReview ? <div className={styles.reviewIntro}>
            <strong>Review this edited opportunity</strong>
            <span>It changed after the last review. Compare the possible matches again before the author can submit it for triage. The earlier decision stays in the record.</span>
          </div> : null}
          {!currentReview ? <div className={styles.compare}><h3>Decide how each possible match relates</h3>
            <p className={styles.progress} role="status">{comparedCount} of {candidateCount} decisions made · {differentCount} different · {sameCount} same</p>
            <p className={styles.instruction}>For each candidate, decide whether it is a different opportunity or the same opportunity. A distinct ruling is available only when every candidate is judged different.</p>
            {sameCount > 0 ? <div className={styles.correctionRequired} role="alert">
              <strong>Distinct ruling is not available</strong>
              <p>You marked {sameCount} possible {sameCount === 1 ? "match" : "matches"} as the same opportunity. Recording “distinct” would contradict those decisions.</p>
              {value.reviewedVersion !== null
                ? <><p>This Work also has an earlier distinct ruling. A separate verified corrector must review that decision before same-work closure. Do not submit this Work for triage on the earlier ruling.</p>
                  <Link href={`/discover-trial/correction/${value.workId}`}>Open separate correction task</Link></>
                : <p>Complete every comparison, then use the same-work closure below and identify the Work that should remain active.</p>}
            </div> : null}
            {value.candidates.length === 0 ? <p>No other captured Work meets this bounded comparison. The reviewer must still explain why the opportunity is distinct.</p> :
              value.candidates.map(candidate => <div key={candidate.workId} className={styles.candidate}>
                <div><strong>{candidate.title}</strong><small>{candidate.customerContext || "Customer provisional"} / {candidate.siteContext || "Site provisional"}<br />Work {candidate.workId} · version {candidate.recordVersion}</small>
                  <span className={styles.registryMatch}>{candidate.accountId === value.accountId
                    ? candidate.siteId === value.siteId ? "Same registered account and site" : "Same registered account · different site"
                    : "Different registered account"}</span>
                  <span className={styles.candidateNeed}>{candidate.needSummary || "No customer need recorded"}</span>
                  <small>Potential work type: {candidate.workType || "not specified"}</small>
                  <div className={styles.choices} role="group" aria-label={`Relationship to ${candidate.title}`}>
                    <label><input type="radio" name={`comparison-${candidate.workId}`} checked={comparisons[candidate.workId] === "different"}
                      disabled={busy || !!pending || !!samePending}
                      onChange={() => setComparisons(previous => ({ ...previous, [candidate.workId]: "different" }))} />Different opportunity</label>
                    <label><input type="radio" name={`comparison-${candidate.workId}`} checked={comparisons[candidate.workId] === "same"}
                      disabled={busy || !!pending || !!samePending}
                      onChange={() => setComparisons(previous => ({ ...previous, [candidate.workId]: "same" }))} />Same opportunity</label>
                  </div></div>
              </div>)}
          </div> : null}
          {!currentReview && sameCount === 0 ? <><label className={styles.reason}>Why are these different customer opportunities?<textarea value={reason} disabled={busy || !!pending || !!samePending}
            maxLength={1000} rows={4} onChange={event => setReason(event.target.value)}
            placeholder="Name the customer, outcome, scope, or timing facts that distinguish this Work from the candidates." /></label>
          <p className={styles.decisionHelp} role="status">{value.selfReview ? "The capture author cannot make this decision."
            : value.legacyHold ? "Resolve the legacy opportunity match before recording a ruling."
            : value.tooManyCandidates ? "This comparison needs escalation because there are too many possible matches."
            : !allCompared ? `Decide whether the remaining ${candidateCount - comparedCount} possible ${candidateCount - comparedCount === 1 ? "match is" : "matches are"} different or the same.`
            : reason.trim().length < 20 ? "Give the specific customer, outcome, scope, or timing facts that support this ruling (at least 20 characters)."
            : "Ready to record this distinct review. The author must submit triage separately."}</p>
          <button type="button" className={styles.primary} disabled={!canDecide && !pending}
            onClick={() => void decide(!!pending)}>{busy ? "Recording…" : pending ? "Retry same review" : "Record distinct ruling"}</button></> : null}
          {!currentReview && sameCount > 0 && value.reviewedVersion === null ? <div className={styles.compare}><h3>Same work · retain one active Work ID</h3>
            {value.candidates.filter(candidate => comparisons[candidate.workId] === "same"
              && candidate.accountId === value.accountId && candidate.siteId === value.siteId).map(candidate => <label key={candidate.workId} className={styles.candidate}>
              <input type="radio" name="retained-work" value={candidate.workId}
                checked={sameWorkId === candidate.workId} disabled={busy || !!pending || !!samePending}
                onChange={() => setSameWorkId(candidate.workId)} />
              <span><strong>{candidate.title}</strong><small>Retain Work {candidate.workId} · version {candidate.recordVersion}</small></span>
            </label>)}
            <label className={styles.reason}>Why is this the same opportunity?<textarea value={sameReason}
              disabled={busy || !!pending || !!samePending} maxLength={1000} rows={4}
              onChange={event => setSameReason(event.target.value)}
              placeholder="Explain the shared customer outcome and why the selected Work should continue." /></label>
            <p className={styles.note}>The retained Work must share the registered account and site. Complete all comparisons before closing this draft. Its source and audit remain; no evidence, acceptance, billing or spending authority moves to the retained Work.</p>
            <button type="button" className={styles.primary} disabled={!canCloseSameWork && !samePending}
              onClick={() => void closeSameWork(!!samePending)}>{busy ? "Recording…" : samePending ? "Retry same closure" : "Close draft as same work"}</button>
          </div> : null}
        </> : null}
      </section>
    </div>
  </main>;
}
