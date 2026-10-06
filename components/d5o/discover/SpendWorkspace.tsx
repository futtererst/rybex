"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestSpendAction, decideSpendAction } from "@/app/discover-trial/opportunity/[workId]/actions";
import type { SpendContext } from "@/lib/d5o/discover/spend";
import styles from "./G1DecisionWorkspace.module.css";

type RequestCommand = { commandId: string; amount: number; currency: "USD";
  expiresOn: string; purpose: string };
type DecisionCommand = { commandId: string; disposition: "authorize" | "decline"; reason: string };

export function SpendWorkspace({ workId, context }: { workId: string; context: SpendContext }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [purpose, setPurpose] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<RequestCommand | null>(null);
  const [pendingDecision, setPendingDecision] = useState<DecisionCommand | null>(null);
  const [feedback, setFeedback] = useState("");

  async function submitRequest(retry = false) {
    if (busy || !context.canRequest || !context.g1DecisionId || !context.recordVersion) return;
    const command = retry && pendingRequest ? pendingRequest : {
      commandId: `d5o-spend-request-${crypto.randomUUID()}`, amount: Number(amount),
      currency: "USD" as const, expiresOn, purpose: purpose.trim(),
    };
    if (!retry && (!Number.isFinite(command.amount) || command.amount <= 0
      || command.amount > (context.maximumRequestAmount ?? 0)
      || !/^\d{4}-\d{2}-\d{2}$/.test(command.expiresOn)
      || command.purpose.length < 20 || command.purpose.length > 1000)) {
      setFeedback("Enter a bounded USD amount, expiry date and a purpose of 20–1,000 characters."); return;
    }
    setPendingRequest(command); setBusy(true); setFeedback("");
    let result: Awaited<ReturnType<typeof requestSpendAction>>;
    try { result = await requestSpendAction({ workId, g1DecisionId: context.g1DecisionId,
      expectedWorkVersion: context.recordVersion, ...command }); }
    catch { result = { status: "unavailable" }; }
    setBusy(false);
    if (result.status === "requested") { setPendingRequest(null); router.refresh(); }
    else if (result.status === "unavailable") setFeedback("The request result is unknown. Retry the same command.");
    else { setPendingRequest(null); setFeedback(result.status === "limit_exceeded"
      ? "The amount or expiry exceeds the synthetic trial limit. Edit the request."
      : result.status === "conflict" ? "The Work or G1 basis changed. Refresh before requesting."
        : result.status === "denied" ? "This identity has no explicit spending-request right for this Work."
          : "Check the amount, date and purpose before retrying."); }
  }
  async function submitDecision(disposition: "authorize" | "decline", retry = false) {
    if (busy || !context.canDecide || !context.requestId || !context.requestDigest) return;
    const command = retry && pendingDecision ? pendingDecision : {
      commandId: `d5o-spend-decision-${crypto.randomUUID()}`, disposition, reason: reason.trim(),
    };
    if (!retry && (command.reason.length < 20 || command.reason.length > 1000)) {
      setFeedback("Record a decision reason of 20–1,000 characters."); return;
    }
    setPendingDecision(command); setBusy(true); setFeedback("");
    let result: Awaited<ReturnType<typeof decideSpendAction>>;
    try { result = await decideSpendAction({ workId, requestId: context.requestId,
      requestDigest: context.requestDigest, ...command }); }
    catch { result = { status: "unavailable" }; }
    setBusy(false);
    if (result.status === "authorized" || result.status === "declined") {
      setPendingDecision(null); router.refresh();
    } else if (result.status === "unavailable") setFeedback("The decision result is unknown. Retry the same command.");
    else { setPendingDecision(null); setFeedback(result.status === "limit_exceeded"
      ? "This request exceeds the finance authority or has expired. Decline it."
      : result.status === "conflict" ? "The request or Work basis changed. Refresh before deciding."
        : result.status === "denied" ? "This identity cannot decide the spending request."
          : "Review the decision reason and try again."); }
  }

  if (context.status === "not_qualified") return null;
  return <section className={styles.panel} aria-label="Bounded investigation spending">
    <h3>Investigation spending · separate decision</h3>
    {context.status === "historical_qualification" ? <p>This earlier synthetic G1 qualification has no recorded strategy basis. A spending request cannot start from it.</p> : null}
    {context.status === "ready_to_request" ? <p>Pursuit is qualified. No investigation expense is authorized. The capture author may request a bounded amount for a separate finance decision.</p> : null}
    {context.status === "ready_to_request" && context.canRequest ? <div className={styles.form}>
      <label>Requested amount · USD · maximum {context.maximumRequestAmount?.toLocaleString()}
        <input type="number" min="0.01" max={context.maximumRequestAmount ?? undefined} step="0.01"
          value={amount} disabled={busy || !!pendingRequest} onChange={e => setAmount(e.target.value)} /></label>
      <label>Authority expires on<input type="date" value={expiresOn} disabled={busy || !!pendingRequest}
        onChange={e => setExpiresOn(e.target.value)} /></label>
      <label>Investigation purpose<textarea rows={3} maxLength={1000} value={purpose}
        disabled={busy || !!pendingRequest} onChange={e => setPurpose(e.target.value)} /></label>
      <p>The synthetic trial limit is 30 days. Sending a request does not authorize spending.</p>
      <div className={styles.actions}><button type="button" disabled={busy}
        onClick={() => void submitRequest(!!pendingRequest)}>
        {pendingRequest ? "Retry same request" : "Send spending request"}</button></div>
    </div> : null}
    {context.requestId ? <div className={styles.result}>
      <strong>{context.status === "pending_decision" ? "Awaiting finance decision"
        : context.status === "authorized" ? "Synthetic spending authority active"
          : context.status === "declined" ? "Spending request declined"
            : context.status === "expired_pending" ? "Request expired without a decision"
              : "Spending authority expired"}</strong>
      <p>{context.amount?.toLocaleString("en-US", { style: "currency", currency: "USD" })} through {context.expiresOn} · {context.purpose}</p>
      {context.decisionReason ? <p><b>Decision reason:</b> {context.decisionReason}</p> : null}
      <p>Request {context.requestId} · exact digest <code>{context.requestDigest}</code></p>
    </div> : null}
    {(context.status === "pending_decision" || context.status === "expired_pending") && context.canDecide ? <div className={styles.form}>
      <p>Finance authority limit: {context.maximumDecisionAmount?.toLocaleString("en-US", { style: "currency", currency: "USD" })}. Review the amount, expiry and purpose above. This is a synthetic trial decision.</p>
      {context.status === "expired_pending" ? <p>The requested expiry has passed. Authorization is blocked; decline records a reason.</p> : null}
      <label>Decision reason<textarea rows={3} maxLength={1000} value={reason}
        disabled={busy || !!pendingDecision} onChange={e => setReason(e.target.value)} /></label>
      <div className={styles.actions}>{pendingDecision
        ? <button type="button" disabled={busy} onClick={() => void submitDecision(pendingDecision.disposition, true)}>Retry same decision</button>
        : <><button type="button" disabled={busy} onClick={() => void submitDecision("decline")}>Decline request</button>
          <button type="button" disabled={busy || context.status === "expired_pending"} onClick={() => void submitDecision("authorize")}>Authorize bounded expense</button></>}</div>
    </div> : null}
    {feedback ? <p className={styles.feedback} role="alert">{feedback}</p> : null}
  </section>;
}
