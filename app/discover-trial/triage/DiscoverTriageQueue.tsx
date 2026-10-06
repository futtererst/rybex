"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { TriageCommandResult, TriageQueueItem, TriageQueueResult } from "@/lib/d5o/discover/triage-transfer";
import { trialMyTriage, trialRespondTriage } from "./actions";
import styles from "./DiscoverTriageQueue.module.css";

export function DiscoverTriageQueue({ workspaceId }: { workspaceId: string }) {
  const [queue, setQueue] = useState<TriageQueueResult | null>(null);
  const [selected, setSelected] = useState<TriageQueueItem | null>(null);
  const [disposition, setDisposition] = useState<"accepted" | "returned">("accepted");
  const [reason, setReason] = useState("");
  const [commandId, setCommandId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<TriageCommandResult | null>(null);
  const refresh = useCallback(async () => {
    try { setQueue(await trialMyTriage(workspaceId)); }
    catch { setQueue({ status: "unavailable" }); }
  }, [workspaceId]);
  useEffect(() => { queueMicrotask(() => { void refresh(); }); }, [refresh]);
  const items = queue?.status === "ok" ? queue.items : [];
  const reasonLength = reason.trim().length;
  const reasonReady = reasonLength >= 20 && reasonLength <= 1000;
  function choose(item: TriageQueueItem) {
    setSelected(item); setDisposition("accepted"); setReason(""); setCommandId(null); setOutcome(null);
  }
  function respond() {
    if (!selected || !reasonReady) return;
    const id = commandId ?? crypto.randomUUID();
    setCommandId(id); setBusy(true); setOutcome(null);
    void trialRespondTriage({ workspaceId, workId: selected.workId,
      submissionId: selected.submissionId, expectedVersion: selected.recordVersion,
      commandId: id, disposition, reason: reason.trim() }).then(next => {
        setOutcome(next);
        if (next.status === "completed") { setSelected(null); void refresh(); }
        else if (next.status !== "unknown_outcome") setCommandId(null);
      }).catch(() => setOutcome({ status: "unknown_outcome", retrySameCommand: true }))
        .finally(() => setBusy(false));
  }
  return <main className={styles.main}>
    <nav className={styles.nav}><Link href="/discover-trial">Discover opportunities</Link><span>/</span><strong>My triage assignments</strong><span>·</span><Link href="/auth/sign-out">Switch trial identity</Link></nav>
    <header><p>Work / Commercial / Discover</p><h1>My triage assignments</h1>
      <p className={styles.lead}>Review a frozen opportunity basis, then accept responsibility or return it to the author for correction. This step does not qualify pursuit or authorize spending.</p></header>
    <div className={styles.toolbar}><span>Assigned to my verified trial identity in this workspace</span><button type="button" onClick={() => void refresh()}>Refresh</button></div>
    {queue === null ? <p role="status">Loading assignments…</p> : null}
    {queue?.status === "denied" ? <p role="alert">This identity has no current Discover triage acceptance right in this workspace.</p> : null}
    {queue?.status === "unavailable" ? <p role="alert">Assignments could not be loaded. Retry; no decision has been made.</p> : null}
    {queue?.status === "ok" && items.length === 0 ? <p>No pending assignments for this owner. An author draft appears here only after its submission succeeds; edits require a fresh independent review before resubmission.</p> : null}
    {queue?.status === "ok" && items.length > 0 ? <div className={styles.layout}>
      <div className={styles.list} aria-label="Pending assignments">{items.map(item => <button type="button" key={item.submissionId}
        className={selected?.submissionId === item.submissionId ? styles.active : styles.card} onClick={() => choose(item)}>
        <strong>{item.title}</strong><span>{item.customerContext || "Customer not supplied"} · {item.siteContext || "Site not supplied"}</span>
        <small>Work {item.workId} · submission {item.submissionRevision}</small>
        <em>{item.overdue ? "Owner response overdue" : item.acceptBy ? `Respond by ${new Date(item.acceptBy).toLocaleString()}` : "No response deadline set"}</em>
      </button>)}</div>
      <section className={styles.detail} aria-label="Assignment decision">{selected ? <>
        <h2>{selected.title}</h2><p>Frozen submission · Work {selected.workId} · version {selected.recordVersion}</p>
        <dl><div><dt>Customer / site</dt><dd>{selected.customerContext} / {selected.siteContext}</dd></div>
          <div><dt>Customer need</dt><dd>{selected.needSummary}</dd></div>
          <div><dt>Source and reference</dt><dd>{selected.source} · {selected.sourceReference}</dd></div>
          <div><dt>Potential work type</dt><dd>{selected.workType}</dd></div>
          <div><dt>Customer response due</dt><dd>{selected.responseDueOn}</dd></div>
          <div><dt>Submitted</dt><dd>{new Date(selected.submittedAt).toLocaleString()}</dd></div></dl>
        <p className={styles.digest}>Snapshot digest {selected.snapshotDigest}</p>
        <fieldset disabled={busy}><legend>My decision</legend>
          <label><input type="radio" name="triage-response" checked={disposition === "accepted"} onChange={() => { setDisposition("accepted"); setCommandId(null); setOutcome(null); }} /> Accept triage responsibility</label>
          <label><input type="radio" name="triage-response" checked={disposition === "returned"} onChange={() => { setDisposition("returned"); setCommandId(null); setOutcome(null); }} /> Return to author for correction</label>
          <label htmlFor="triage-reason">Decision reason</label><textarea id="triage-reason" value={reason} maxLength={1000}
            aria-describedby="triage-reason-help" aria-invalid={reasonLength > 0 && !reasonReady}
            onChange={event => { setReason(event.target.value); setCommandId(null); setOutcome(null); }} placeholder="Why you accept or what the author must correct (20–1000 characters)." />
          <p id="triage-reason-help" className={styles.reasonHelp} role="status">{reasonReady
            ? `Reason ready · ${reasonLength} characters. ${disposition === "accepted" ? "Accepting assigns triage responsibility only." : "Returning sends this reason to the author."}`
            : `${reasonLength}/20 minimum characters · ${20 - reasonLength} more needed. Explain ${disposition === "accepted" ? "why you accept responsibility" : "what the author must correct"}.`}</p>
        </fieldset><button type="button" className={styles.primary} disabled={busy || !reasonReady} onClick={respond}>
          {busy ? "Recording decision…" : commandId ? "Retry same decision" : disposition === "accepted" ? "Accept assignment" : "Return to author"}</button>
        <p>Acceptance assigns commercial triage responsibility only. The Work retains its identity and audit trail.</p>
      </> : <p>Select an assignment to inspect its submitted basis.</p>}</section>
    </div> : null}
    {outcome?.status === "completed" ? <p role="status">{outcome.lifecycleState === "triage_assigned" ? "Assignment accepted" : "Returned to author"} on Work {outcome.workId}. The decision was recorded.</p> : null}
    {outcome?.status === "unknown_outcome" ? <p role="alert">The result is uncertain. Retry the same decision and command.</p> : null}
    {outcome && "message" in outcome ? <p role="alert">{outcome.message}</p> : null}
  </main>;
}
