"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitD2HandoffAction, respondD2HandoffAction } from "@/app/discover-trial/opportunity/[workId]/actions";
import type { D2Brief, D2HandoffContext } from "@/lib/d5o/discover/d2-handoff";
import styles from "./G1DecisionWorkspace.module.css";

type SubmitCommand = { commandId: string; brief: D2Brief };
type ResponseCommand = { commandId: string; disposition: "accepted" | "returned"; reason: string };

export function D2HandoffWorkspace({ workId, context, proposedReceiverId, proposedReceiverName }: {
  workId: string; context: D2HandoffContext; proposedReceiverId: string | null;
  proposedReceiverName: string | null;
}) {
  const router = useRouter();
  const previous = context.brief;
  const [customerNeed, setCustomerNeed] = useState(previous?.customerNeed ?? "");
  const [scopeBoundary, setScopeBoundary] = useState(previous?.scopeBoundary ?? "");
  const [assumptions, setAssumptions] = useState(previous?.assumptions.join("\n") ?? "");
  const [unknowns, setUnknowns] = useState(previous?.unknowns.join("\n") ?? "");
  const [dueOn, setDueOn] = useState(previous?.dueOn ?? "");
  const [action, setAction] = useState(previous?.actions[0]?.text ?? "");
  const [actionDueOn, setActionDueOn] = useState(previous?.actions[0]?.dueOn ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pendingSubmit, setPendingSubmit] = useState<SubmitCommand | null>(null);
  const [pendingResponse, setPendingResponse] = useState<ResponseCommand | null>(null);
  const receiverId = proposedReceiverId ?? context.receiverProfileId;

  async function submit(retry = false) {
    if (busy || !context.canSubmit || !context.g1DecisionId || !receiverId) return;
    const brief: D2Brief = {
      customerNeed: customerNeed.trim(), scopeBoundary: scopeBoundary.trim(),
      assumptions: assumptions.split("\n").map(x => x.trim()).filter(Boolean),
      unknowns: unknowns.split("\n").map(x => x.trim()).filter(Boolean),
      dueOn, actions: [{ text: action.trim(), ownerProfileId: receiverId, dueOn: actionDueOn }],
    };
    const command = retry && pendingSubmit ? pendingSubmit : {
      commandId: `d5o-d2-submit-${crypto.randomUUID()}`, brief,
    };
    if (!retry && (brief.customerNeed.length < 20 || brief.scopeBoundary.length < 20
      || brief.actions[0].text.length < 10 || !brief.dueOn || !brief.actions[0].dueOn)) {
      setFeedback("Record the customer need and scope boundary (at least 20 characters each), an owned action (at least 10 characters), and both due dates.");
      return;
    }
    setBusy(true); setFeedback(""); setPendingSubmit(command);
    let result: Awaited<ReturnType<typeof submitD2HandoffAction>>;
    try { result = await submitD2HandoffAction({ workId, g1DecisionId: context.g1DecisionId,
      expectedWorkVersion: context.recordVersion, receiverProfileId: receiverId, ...command }); }
    catch { result = { status: "unavailable" }; }
    setBusy(false);
    if (result.status === "submitted") { setPendingSubmit(null); router.refresh(); }
    else if (result.status === "unavailable") setFeedback("The result is unknown. Retry the same handoff command before editing this brief.");
    else { setPendingSubmit(null); setFeedback(result.status === "conflict"
      ? "The Work or decision basis changed. Refresh and review before sending."
      : result.status === "denied" ? "This identity lacks the explicit D2 handoff right."
        : "Review the brief, action owner and due dates before sending."); }
  }

  async function respond(disposition: "accepted" | "returned", retry = false) {
    if (busy || !context.canRespond || !context.submissionId || !context.briefDigest) return;
    const command = retry && pendingResponse ? pendingResponse : {
      commandId: `d5o-d2-response-${crypto.randomUUID()}`, disposition, reason: reason.trim(),
    };
    if (!retry && (command.reason.length < 20 || command.reason.length > 1000)) {
      setFeedback("Record a reason of 20–1,000 characters for the receiving decision."); return;
    }
    setBusy(true); setFeedback(""); setPendingResponse(command);
    let result: Awaited<ReturnType<typeof respondD2HandoffAction>>;
    try { result = await respondD2HandoffAction({ workId, submissionId: context.submissionId,
      briefDigest: context.briefDigest, ...command }); }
    catch { result = { status: "unavailable" }; }
    setBusy(false);
    if (result.status === "accepted" || result.status === "returned") {
      setPendingResponse(null); router.refresh();
    } else if (result.status === "unavailable") setFeedback("The result is unknown. Retry the same response command.");
    else { setPendingResponse(null); setFeedback(result.status === "conflict"
      ? "This handoff changed. Refresh before deciding."
      : result.status === "denied" ? "Only the explicitly assigned receiving owner may decide this handoff."
        : "Review the reason before deciding."); }
  }

  return <section className={styles.panel} aria-label="Define receiving handoff">
    <h3>Define receiving handoff · same Work</h3>
    <p>Move the qualified opportunity into a bounded Define brief. The receiving owner may accept responsibility or return it for correction. Neither response authorizes spending or closes Discover.</p>
    <div className={styles.result} role="status"><strong>{context.status === "not_started" ? "Brief not sent"
      : context.status === "awaiting_receiver" ? "Awaiting receiving owner"
        : context.status === "returned" ? "Returned to author for correction"
          : "Receiving owner accepted"}</strong>
      {context.revision ? <p>Handoff revision {context.revision} · Work {workId}</p> : null}
      {context.responseReason ? <p>Owner reason: {context.responseReason}</p> : null}
    </div>
    {context.canSubmit && context.status !== "accepted" ? <div className={styles.form}>
      <p>Receiving owner: <strong>{proposedReceiverName ?? "Owner selected in G1 assessment"}</strong>. The receiver must match the qualified G1 decision.</p>
      <label>Customer need<textarea rows={3} maxLength={2000} value={customerNeed} disabled={busy || !!pendingSubmit} onChange={e => setCustomerNeed(e.target.value)} /></label>
      <label>Define scope boundary<textarea rows={3} maxLength={2000} value={scopeBoundary} disabled={busy || !!pendingSubmit} onChange={e => setScopeBoundary(e.target.value)} /></label>
      <label>Assumptions · one per line<textarea rows={3} value={assumptions} disabled={busy || !!pendingSubmit} onChange={e => setAssumptions(e.target.value)} /></label>
      <label>Unknowns · one per line<textarea rows={3} value={unknowns} disabled={busy || !!pendingSubmit} onChange={e => setUnknowns(e.target.value)} /></label>
      <label>Brief due date<input type="date" value={dueOn} disabled={busy || !!pendingSubmit} onChange={e => setDueOn(e.target.value)} /></label>
      <label>First owned action<textarea rows={2} value={action} disabled={busy || !!pendingSubmit} onChange={e => setAction(e.target.value)} /></label>
      <label>Action due date<input type="date" value={actionDueOn} disabled={busy || !!pendingSubmit} onChange={e => setActionDueOn(e.target.value)} /></label>
      <div className={styles.actions}><button type="button" disabled={busy || !receiverId} onClick={() => void submit(!!pendingSubmit)}>{pendingSubmit ? "Retry same handoff" : context.status === "returned" ? "Send corrected brief" : "Send to Define owner"}</button></div>
    </div> : null}
    {context.brief ? <div className={styles.result}>
      <h4>Frozen brief · revision {context.revision}</h4>
      <p><strong>Customer need:</strong> {context.brief.customerNeed}</p>
      <p><strong>Scope boundary:</strong> {context.brief.scopeBoundary}</p>
      <p><strong>Assumptions:</strong> {context.brief.assumptions.join("; ") || "None recorded"}</p>
      <p><strong>Unknowns:</strong> {context.brief.unknowns.join("; ") || "None recorded"}</p>
      <p><strong>Due:</strong> {context.brief.dueOn}</p>
      {context.brief.actions.map((item, i) => <p key={i}><strong>Owned action {i + 1}:</strong> {item.text} · due {item.dueOn}</p>)}
      <p>Snapshot digest: <code>{context.briefDigest}</code></p>
    </div> : null}
    {context.canRespond && context.status === "awaiting_receiver" ? <div className={styles.form}>
      <label>Receiving decision reason<textarea rows={3} maxLength={1000} value={reason} disabled={busy || !!pendingResponse} onChange={e => setReason(e.target.value)} /></label>
      <div className={styles.actions}>
        {pendingResponse ? <button type="button" disabled={busy} onClick={() => void respond(pendingResponse.disposition, true)}>Retry same response</button> : <>
          <button type="button" disabled={busy} onClick={() => void respond("returned")}>Return for correction</button>
          <button type="button" disabled={busy} onClick={() => void respond("accepted")}>Accept responsibility</button>
        </>}
      </div>
    </div> : null}
    {feedback ? <p className={styles.feedback} role="alert">{feedback}</p> : null}
    {context.history.length ? <details><summary>Handoff history · {context.history.length} revision{context.history.length === 1 ? "" : "s"}</summary>
      <ol>{context.history.map(entry => <li key={entry.submissionId}>Revision {entry.revision} · {entry.disposition ?? "pending"} · {entry.reason ?? "No response yet"} · <code>{entry.briefDigest}</code></li>)}</ol>
    </details> : null}
  </section>;
}
