"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { decideG1Action, reopenG1AssessmentAction } from "@/app/discover-trial/opportunity/[workId]/actions";
import type { G1DecisionContext } from "@/lib/d5o/discover/g1-decision";
import styles from "./G1DecisionWorkspace.module.css";

type DecisionCommand = { commandId: string; disposition: "return" | "qualify";
  reason: string; conditions: string };

export function G1DecisionWorkspace({ workId, context, proposedCapAmount }: {
  workId: string; context: G1DecisionContext; proposedCapAmount: number | null;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [conditions, setConditions] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<DecisionCommand | null>(null);
  const [reopenCommand, setReopenCommand] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  async function decide(disposition: "return" | "qualify", retry = false) {
    if (busy || !context.assessmentId || !context.packageDigest || !context.recordVersion) return;
    const command = retry && pending ? pending : {
      commandId: `d5o-g1-decision-${crypto.randomUUID()}`, disposition,
      reason: reason.trim(), conditions: disposition === "qualify" ? conditions.trim() : "",
    };
    if (!retry && (command.reason.length < 20 || command.reason.length > 1000
      || (command.conditions && (command.conditions.length < 20 || command.conditions.length > 2000)))) {
      setFeedback("Give a decision reason of 20–1,000 characters. Conditions, if used, need 20–2,000 characters.");
      return;
    }
    setPending(command); setBusy(true); setFeedback("");
    let result: Awaited<ReturnType<typeof decideG1Action>>;
    try { result = await decideG1Action({ workId, assessmentId: context.assessmentId,
      packageDigest: context.packageDigest, expectedWorkVersion: context.recordVersion,
      ...command }); }
    catch { result = { status: "unavailable" }; }
    setBusy(false);
    if (result.status === "returned" || result.status === "qualified") {
      setPending(null); router.refresh();
    } else if (result.status === "unavailable") {
      setFeedback("The decision result is unknown. Retry the same command before taking another action.");
    } else {
      setPending(null);
      setFeedback(result.status === "conflict" ? "This package changed or was already decided. Refresh before deciding."
        : result.status === "limit_exceeded" ? "The proposed pursuit cap exceeds this reviewer's configured limit. Return the package for correction."
        : result.status === "basis_changed" ? "The registered account/site, source, customer deadline or next owner is no longer current. Return the package for correction."
        : result.status === "strategy_blocked" ? "Strategy or reserved-matter eligibility is missing, blocked or changed. Refresh and return the package for correction."
        : result.status === "denied" ? "This identity cannot decide G1 for this Work."
          : "Review the decision reason and conditions.");
    }
  }
  async function reopen(retry = false) {
    if (busy || !context.assessmentId) return;
    const commandId = retry && reopenCommand ? reopenCommand : `d5o-g1-reopen-${crypto.randomUUID()}`;
    setReopenCommand(commandId); setBusy(true); setFeedback("");
    let result: Awaited<ReturnType<typeof reopenG1AssessmentAction>>;
    try { result = await reopenG1AssessmentAction({ workId, assessmentId: context.assessmentId, commandId }); }
    catch { result = { status: "unavailable" }; }
    setBusy(false);
    if (result.status === "opened") { setReopenCommand(null); router.refresh(); }
    else if (result.status === "unavailable") setFeedback("The correction result is unknown. Retry the same command.");
    else { setReopenCommand(null); setFeedback(result.status === "conflict"
      ? "This package is no longer the current returned version. Refresh the Work."
      : "The correction cannot be opened by this identity."); }
  }

  if (context.status === "not_started") return null;
  if (context.status === "preparing") return context.decisionReason
    ? <section className={styles.panel} aria-label="G1 correction status"><h3>G1 correction in progress</h3>
      <p>Earlier reviewer return: {context.decisionReason}</p>
      <p>The author’s current draft is private until a new package is submitted. Spending remains unauthorized.</p></section>
    : null;
  return <section className={styles.panel} aria-label="G1 decision">
    <h3>G1 pursuit decision</h3>
    {context.status === "pending_decision" ? <p>Assessment revision {context.assessmentRevision} is awaiting a separate decision. The exact package digest is <code>{context.packageDigest}</code>.</p> : null}
    {context.status === "pending_decision" ? <div className={styles.result}>
      <strong>Strategy and reserved-matter check: {context.strategyStatus ?? "unavailable"}</strong>
      <p>{context.strategyReason ?? "The strategy rule has not been resolved for this package."}</p>
      {!context.canQualify ? <p>Qualification is blocked. The reviewer may return this package for correction.</p> : null}
    </div> : null}
    {context.status === "returned" ? <div className={styles.result}>
      <strong>Returned for correction</strong><p>{context.decisionReason}</p>
      <p>The submitted package is retained. The author can open a new draft revision.</p>
      {context.canReopen ? <button type="button" disabled={busy} onClick={() => void reopen(!!reopenCommand)}>
        {reopenCommand ? "Retry same correction command" : "Open correction draft"}</button> : null}
    </div> : null}
    {context.status === "qualified" ? <div className={styles.result}>
      <strong>Trial G1 pursuit qualification recorded for this package</strong><p>{context.decisionReason}</p>
      {context.decisionConditions ? <p><b>Conditions:</b> {context.decisionConditions}</p> : null}
      {context.strategyStatus === "historical_unrecorded" ? <p>This earlier synthetic decision has no pinned strategy rule and is not evidence of a complete v4 G1 gate.</p> : null}
      <p>G1 qualification itself does not authorize spending. Any bounded expense needs the separate decision shown below. Project receiving acceptance and later phase gates remain separate.</p>
    </div> : null}
    {context.status === "pending_decision" && context.canDecide ? <div className={styles.form}>
      <label>Decision reason<textarea value={reason} maxLength={1000} rows={4}
        disabled={busy || !!pending} onChange={event => setReason(event.target.value)} /></label>
      <label>Qualification conditions · optional<textarea value={conditions} maxLength={2000} rows={3}
        disabled={busy || !!pending} onChange={event => setConditions(event.target.value)} /></label>
      <p>Returning requests a corrected package. Qualifying selects this opportunity for pursuit only; neither action approves spending.</p>
      {context.maximumProposedCapAmount != null ? <p>Reviewer limit for the proposed cap: {context.maximumProposedCapAmount.toLocaleString()}.
        {proposedCapAmount != null && proposedCapAmount > context.maximumProposedCapAmount
          ? " This package exceeds that limit and can only be returned for correction." : ""}</p> : null}
      <div className={styles.actions}>{pending
        ? <button type="button" disabled={busy} onClick={() => void decide(pending.disposition, true)}>Retry same {pending.disposition} command</button>
        : <><button type="button" disabled={busy} onClick={() => void decide("return")}>Return for correction</button>
          <button type="button" disabled={busy || !context.canQualify || (context.maximumProposedCapAmount != null
            && proposedCapAmount != null && proposedCapAmount > context.maximumProposedCapAmount)}
            onClick={() => void decide("qualify")}>Qualify pursuit</button></>}</div>
    </div> : null}
    {feedback ? <p className={styles.feedback} role={pending || reopenCommand ? "alert" : "status"}>{feedback}</p> : null}
  </section>;
}
