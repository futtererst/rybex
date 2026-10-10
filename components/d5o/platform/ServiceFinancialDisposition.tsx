"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { WorkRecord } from "./work-types";
import style from "./OperateWorkspace.module.css";

type Basis = {
  requestId: string; requestCycleAt: string; coverage: string; requestStatus: string;
  agreementName?: string; agreementSource?: string; agreementRevision?: string;
  agreementIncludes?: string; agreementExcludes?: string;
  coveredScope?: string; uncoveredScope?: string; uncoveredAmountMinor?: string;
  currency?: string; estimateRevision?: string; policyId?: string; policyVersion?: string;
  authorizationEvidenceId?: string; reviewedHours?: number; reviewedQuantity?: number;
  authorizationConditions?: string; billingTermsKnown?: boolean;
  jobStatus?: string; releaseId?: string; workAcceptanceId?: string;
  designRevision?: number; deployRevision?: number; eligibleForFinanceReview: boolean;
};
type Decision = {
  status: "Prepared" | "Ready for billing" | "Hold"; revision: number;
  prepared_by: string; prepared_at: string; reviewed_by?: string; reviewed_at?: string;
  review_reason?: string; billing_terms_statement?: string;
  billing_terms_evidence_id?: string;
};
type Read = {
  basis: Basis; basisDigest: string; revision: number;
  workRevision: number; operateRevision: number;
  decision: Decision | null; decisionCurrent: boolean;
  history: Array<{ revision: number; action: string; at: string }>;
};
const money = (minor: string | undefined, currency: string | undefined) => {
  if (!minor || !currency || !/^\d+$/.test(minor) || !Number.isSafeInteger(Number(minor)))
    return "Unknown";
  try {
    const format = new Intl.NumberFormat(undefined, { style: "currency", currency });
    return format.format(Number(minor) / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2));
  } catch { return "Unknown"; }
};

export function ServiceFinancialDisposition({
  work, requestId, actorRole
}: { work: WorkRecord; requestId: string; actorRole?: string }) {
  const [position, setPosition] = useState<Read | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/d5o-hosted/service-finance?workspace=${encodeURIComponent(work.workspace)}`;
  const refresh = useCallback(async () => {
    const response = await fetch(`${endpoint}&workId=${encodeURIComponent(work.id)}&requestId=${encodeURIComponent(requestId)}`,
      { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Service Finance basis unavailable");
    setPosition(body as Read);
  }, [endpoint, work.id, requestId]);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (live) void refresh().catch((cause) => { if (live) setError(String(cause)); });
    });
    return () => { live = false; };
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>, action: "prepare" | "review-ready" | "review-hold") {
    event.preventDefault();
    if (!position) return;
    const form = event.currentTarget;
    setBusy(true); setError("");
    try {
      const data = new FormData(form);
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: work.id, requestId, action, commandId: crypto.randomUUID(),
          expectedWorkRevision: position.workRevision,
          expectedOperateRevision: position.operateRevision,
          expectedDesignRevision: position.basis.designRevision,
          expectedDeployRevision: position.basis.deployRevision,
          expectedFinanceRevision: position.revision, basisDigest: position.basisDigest,
          note: String(data.get("note") ?? "").trim(),
          billingTermsEvidenceId: String(data.get("billingTermsEvidenceId") ?? "").trim(),
          billingTermsStatement: String(data.get("billingTermsStatement") ?? "").trim()
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Service Finance decision rejected");
      await refresh();
      form.reset();
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  }

  const basis = position?.basis;
  const decision = position?.decision;
  return <section className={style.card} aria-label="Service financial disposition">
    <div className={style.cardHead}><h3>Service financial disposition</h3>
      <p>Coverage, customer authorization, physical completion and billing remain separate decisions.</p></div>
    {error ? <p role="alert">{error}</p> : null}
    {!basis ? <p>Loading the exact service basis…</p> : <>
      <div className={style.row}><b>{basis.coverage} · {basis.requestStatus}</b>
        <span>Current request cycle {basis.requestCycleAt}</span>
        <small>Covered: {basis.coveredScope || "No covered scope recorded"}.
          Agreement: {basis.agreementName || "Unknown"} r{basis.agreementRevision || "?"}
          · {basis.agreementSource || "Source unknown"}.</small>
        <small>Uncovered: {basis.uncoveredScope || "No uncovered scope recorded"}.
          Approved estimate r{basis.estimateRevision || "?"}
          · customer-authorized {money(basis.uncoveredAmountMinor, basis.currency)}
          · retained document {basis.authorizationEvidenceId || "missing"}.</small>
        <small>Reviewed execution: {basis.reviewedQuantity ?? "unknown"} service visit;
          {basis.reviewedHours ?? "unknown"} actual hours. Release {basis.releaseId || "missing"};
          accepted scope {basis.workAcceptanceId || "missing"}.</small>
      </div>
      <p>Actual incurred cost: unknown · billing terms: {decision?.billing_terms_statement || basis.authorizationConditions || "not established in the retained customer authorization"}
        · invoice: pending/unknown · payment: pending/unknown. Actual hours are not a time-and-materials charge.</p>
      {decision ? <div className={style.row}><b>{position?.decisionCurrent ? decision.status : `${decision.status} · historical basis`}</b>
        <span>Decision r{decision.revision} · prepared by {decision.prepared_by} on {decision.prepared_at}</span>
        {decision.reviewed_by ? <small>Finance reviewer {decision.reviewed_by} · {decision.reviewed_at}
          · {decision.review_reason}</small> : null}</div> : <p>No Finance disposition has been recorded.</p>}
      {!basis.eligibleForFinanceReview ? <p role="alert">Current completed service source is incomplete or changed. Reconcile its request, approved price, release and acceptance before review.</p> : null}
      {actorRole === "project_manager" && basis.eligibleForFinanceReview ?
        <form className={style.form} onSubmit={(event) => void submit(event, "prepare")}>
          <b>Prepare exact service basis for independent Finance review</b>
          {basis.billingTermsKnown ? <>
            <label>Billing-terms document ID (retained customer authorization)
              <input name="billingTermsEvidenceId" /></label>
            <label>Exact billing terms recorded in that authorization
              <input name="billingTermsStatement" /></label>
          </> : <p>The retained authorization does not state billing terms. Prepare this basis for a Finance hold; do not infer terms from the approved amount or actual hours.</p>}
          <label>Preparation reason and unresolved obligations<input name="note" required minLength={15} /></label>
          <button disabled={busy}>Prepare Finance review</button>
        </form> : null}
      {actorRole === "billing_commercial_lead" && decision?.status === "Prepared" &&
        position?.decisionCurrent && basis.eligibleForFinanceReview ? <>
          <form className={style.form} onSubmit={(event) => void submit(event, "review-ready")}>
            <label>Why the retained terms make this exact amount billable<input name="note" required minLength={20} /></label>
            <button disabled={busy || !decision.billing_terms_evidence_id || !decision.billing_terms_statement}>
              Mark supported amount ready for billing</button>
          </form>
          <form className={style.form} onSubmit={(event) => void submit(event, "review-hold")}>
            <label>Concrete Finance hold reason and next source needed<input name="note" required minLength={20} /></label>
            <button disabled={busy}>Hold billing</button>
          </form>
        </> : null}
      <small>{position?.history.length ?? 0} retained Finance event(s). Ready for billing never records an invoice or payment.</small>
    </>}
  </section>;
}
