"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { WorkRecord } from "./work-types";

import { assessJobFinance, dollarsToMinor, moneyMinor, type JobFinanceRead } from "./job-finance-model";
import { deployState } from "./deploy-model";

import style from "./OperateWorkspace.module.css";

const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export function JobFinancePanel({ work, actorRole }: { work: WorkRecord; actorRole: string }) {

  const [state, setState] = useState<JobFinanceRead | null>(null);

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);
  const [billingPackageId, setBillingPackageId] = useState("");

  const canFinance = actorRole === "billing_commercial_lead";

  const canDraft = canFinance || actorRole === "project_manager";

  const load = useCallback(async () => {

    const response = await fetch(`/api/d5o-hosted/job-finance?workspace=${encodeURIComponent(work.workspace)}&workId=${encodeURIComponent(work.id)}`, { cache: "no-store" });

    const body = await response.json() as JobFinanceRead & { error?: string };

    if (!response.ok) throw new Error(body.error ?? "Job finance unavailable");

    setState(body); setError("");

  }, [work.workspace, work.id]);

  useEffect(() => { void Promise.resolve().then(load).catch((cause) => setError(cause instanceof Error ? cause.message : "Job finance unavailable")); }, [load]);

  async function send(action: string, data: Record<string, unknown>) {

    if (!state) return;

    setBusy(true); setError("");

    try {

      const response = await fetch("/api/d5o-hosted/job-finance", { method: "POST",

        headers: { "Content-Type": "application/json" }, body: JSON.stringify({

          workspace: work.workspace, workId: work.id, action, data,

          expectedRevision: state.revision, commandId: crypto.randomUUID()

        }) });

      const result = await response.json() as { error?: string };

      if (!response.ok) throw new Error(result.error ?? "Finance action rejected");

      await load();

    } catch (cause) { setError(cause instanceof Error ? cause.message : "Finance action unavailable"); }

    finally { setBusy(false); }

  }

  const submit = (action: string, map: (data: FormData) => Record<string, unknown>) =>

    (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void send(action,map(new FormData(event.currentTarget))); };

  if (!state) return <section className={style.card}><h3>Job financial position</h3><p role={error ? "alert" : "status"}>{error || "Loading sourced job costs and billing…"}</p></section>;

  const view = assessJobFinance(state,work);

  const currency = view.currency ?? "USD";

  return <section className={style.card}>

    <h3>Job cost, margin and billing readiness</h3>

    <p>Fixed-price pilot basis · {view.currency ?? "currency unknown"}. Amounts are separate from support activation and physical acceptance. Reviewed hours support cost investigation; they are not actual incurred cost until Finance records a sourced entry.</p>

    {error ? <p role="alert">{error}</p> : null}

    <div className={style.grid}>

      <span><b>Original awarded contract</b>{moneyMinor(view.original, currency)}<small>Offer rev {state.baseline?.revision ?? "unknown"} · event {state.baseline?.awardEventId ?? "unavailable"}</small></span>

      <span><b>Approved estimate cost basis</b>{moneyMinor(state.baseline?.pricingBasis?.includedCostMinor ?? null,currency)}<small>Estimate rev {state.baseline?.estimateRevision ?? "unknown"} · policy {state.baseline?.pricingBasis?.policyId ?? "unknown"} v{state.baseline?.pricingBasis?.policyVersion ?? "?"}. This is the pricing basis, not actual incurred cost.</small></span>

      <span><b>Authorized changes</b>{moneyMinor(view.revised === null || view.original === null ? null : view.revised-view.original,currency)}<small>{view.changes.length} exact change records</small></span>

      <span><b>Revised contract value</b>{moneyMinor(view.revised,currency)}</span>

      <span><b>Incurred cost</b>{moneyMinor(view.incurred,currency)}</span>

      <span><b>Outstanding commitments</b>{moneyMinor(view.outstanding,currency)}</span>

      <span><b>Remaining uncommitted forecast</b>{moneyMinor(view.remaining,currency)}<small>{state.forecastSource ?? "No source recorded"}</small></span>

      <span><b>Forecast final cost</b>{moneyMinor(view.forecastFinal,currency)}</span>

      <span><b>Forecast gross profit / margin</b>{moneyMinor(view.forecastProfit,currency)} · {view.forecastMargin === null ? "Unknown" : `${view.forecastMargin.toFixed(1)}%`}</span>

      <span><b>Recorded billed / paid</b>{moneyMinor(view.billed,currency)} / {moneyMinor(view.paid,currency)}</span>

    </div>

    {view.blocked.length ? <p role="status">{view.blocked.join(" ")}</p> : null}

    <h4>Reviewed field activity supporting cost review</h4>

    {deployState(work).reports.filter((report) => report.status === "Reviewed").map((report) => <p key={report.id}>{report.date} · package {report.packageId} · {report.laborHours} reviewed hours · {report.quantity} {report.unit} · report {report.id}. Finance records separately sourced incurred cost.</p>)}

    <h4>Authorized change drill-down</h4>

    {view.changes.length ? view.changes.map((item) => <p key={item.id}>Package {item.packageId} · {moneyMinor(item.amountMinor,currency)} · customer authority and revised Design release {item.revisedReleaseId}</p>) : <p>No authorized revised scope is counted.</p>}

    <h4>Cost composition and sources</h4>

    {state.costs.length ? state.costs.map((item) => <p key={item.id}>{item.kind} · {item.category} · {moneyMinor(item.amount_minor,currency)} · {item.cost_date} · package {item.package_id ?? "job"} · {item.source}{item.reconciles_id ? ` · reduces commitment ${item.reconciles_id}` : ""}</p>) : <p>No incurred or committed costs recorded. Unknown actual costs are not zero.</p>}

    {canFinance ? <div className={style.grid}>

      <form className={style.form} onSubmit={submit("add-cost",(data)=>({ category: field(data,"category"),kind:field(data,"kind"),amountMinor:dollarsToMinor(field(data,"amount")),costDate:field(data,"date"),source:field(data,"source"),packageId:field(data,"packageId")||undefined,reconcilesId:field(data,"reconcilesId")||undefined }))}>

        <h4>Record sourced cost or commitment</h4><label>Kind<select name="kind"><option>Incurred</option><option>Committed</option></select></label><label>Category<select name="category"><option>Labor</option><option>Material</option><option>Equipment</option><option>Subcontract</option></select></label><label>Amount in {currency}<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Cost date<input name="date" type="date" required /></label><label>Package<select name="packageId"><option value="">Whole job</option>{work.packages?.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Source reference<input name="source" minLength={8} required /></label><label>Reconcile commitment<select name="reconcilesId"><option value="">New cost</option>{state.costs.filter((item)=>item.kind==="Committed").map((item)=><option key={item.id} value={item.id}>{item.category} · {moneyMinor(item.amount_minor,currency)} · {item.source}</option>)}</select></label><button disabled={busy}>Record cost fact</button>

      </form>

      <form className={style.form} onSubmit={submit("set-remaining",(data)=>({ amountMinor:dollarsToMinor(field(data,"amount")),forecastAt:field(data,"date"),source:field(data,"source") }))}>

        <h4>Forecast remaining uncommitted cost</h4><label>Amount in {currency}<input name="amount" type="number" min="0" step="0.01" required /></label><label>Assessment date<input name="date" type="date" required /></label><label>Basis and source<input name="source" minLength={8} required /></label><button disabled={busy}>Record forecast</button>

      </form>

    </div> : null}

    <h4>Billing eligibility by accepted package</h4>

    {view.eligible.length ? view.eligible.map((item)=><p key={item.packageId}>{item.packageName} · release {item.releaseId} · {item.reviewedQuantity ?? "qualitative"} {item.unit ?? "scope"} reviewed · {item.evidence.length} reviewed evidence items</p>) : <p>Unaccepted scope and unreviewed proof cannot enter a billing draft.</p>}

    {canDraft && view.eligible.length ? <form className={style.form} onSubmit={submit("draft-bill",(data)=>({ lines:[{ packageId:field(data,"packageId"),description:field(data,"description"),amountMinor:dollarsToMinor(field(data,"amount")),quantity:field(data,"quantity"),unit:field(data,"unit"),evidenceId:field(data,"evidenceId") }] }))}>

      <h4>Draft a package billing line</h4><label>Accepted package<select name="packageId" required value={billingPackageId || view.eligible[0]?.packageId || ""} onChange={(event)=>setBillingPackageId(event.target.value)}>{view.eligible.map((item)=><option key={item.packageId} value={item.packageId}>{item.packageName}</option>)}</select></label><label>Line scope<input name="description" minLength={5} required /></label><label>Accepted quantity<input name="quantity" type="number" min="0.001" step="0.001" required /></label><label>Unit<input name="unit" required placeholder="Use accepted completion unit" /></label><label>Amount in {currency}<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Reviewed package evidence<select name="evidenceId" required><option value="">Choose reviewed proof</option>{view.eligible.filter((item)=>item.packageId === (billingPackageId || view.eligible[0]?.packageId)).flatMap((item)=>item.evidence.map((proof)=><option key={proof.id} value={proof.id}>{item.packageName} · {proof.filename}</option>))}</select></label><button disabled={busy}>Save draft billing record</button>

    </form> : null}

    <h4>Billing records and source events</h4>

    {state.bills.map((bill)=><article key={bill.id}><strong>{bill.status} · {bill.id}</strong><p>{bill.lines.map((line)=>`${line.description}: ${moneyMinor(line.amountMinor,currency)} · package ${line.packageId} · proof ${line.evidenceId}`).join("; ")}</p>

      {bill.status==="Draft" && canDraft ? <button disabled={busy} onClick={()=>void send("submit-bill",{billId:bill.id})}>Submit for independent Finance review</button> : null}

      {bill.status==="In review" && canFinance ? <form className={style.form} onSubmit={submit("review-bill",(data)=>({billId:bill.id,decision:field(data,"decision"),reason:field(data,"reason")}))}><label>Decision<select name="decision"><option>Reviewed</option><option>Returned</option></select></label><label>Reason<input name="reason" minLength={10} required /></label><button disabled={busy}>Record Finance review</button></form> : null}

      {bill.status==="Reviewed" && canFinance ? <form className={style.form} onSubmit={submit("record-billed",(data)=>({billId:bill.id,amountMinor:dollarsToMinor(field(data,"amount")),eventDate:field(data,"date"),source:field(data,"source")}))}><label>Recorded billed amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Date<input name="date" type="date" required /></label><label>External billing reference<input name="source" minLength={8} required /></label><button disabled={busy}>Record billed event</button></form> : null}

      {bill.status==="Reviewed" && canFinance ? <form className={style.form} onSubmit={submit("record-paid",(data)=>({billId:bill.id,amountMinor:dollarsToMinor(field(data,"amount")),eventDate:field(data,"date"),source:field(data,"source")}))}><label>Recorded payment<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Date<input name="date" type="date" required /></label><label>External payment reference<input name="source" minLength={8} required /></label><button disabled={busy}>Record paid event</button></form> : null}

    </article>)}

    {state.cashEvents.map((item)=><p key={item.id}>{item.kind} · {moneyMinor(item.amount_minor,currency)} · {item.event_date} · {item.source} · bill {item.bill_id}</p>)}

    <p>Billing draft, recorded invoice and recorded payment are separate facts. This prototype does not submit invoices or collect money.</p>

  </section>;

}
