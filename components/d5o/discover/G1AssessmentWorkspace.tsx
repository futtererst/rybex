"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { G1AssessmentContext, G1AssessmentPayload, G1AssessmentWriteResult } from "@/lib/d5o/discover/g1-assessment";
import { writeG1AssessmentAction } from "@/app/discover-trial/opportunity/[workId]/actions";
import styles from "./G1AssessmentWorkspace.module.css";

type Props = { workId: string; context: G1AssessmentContext;
  ownerOptions: { profileId: string; label: string }[]; ownerOptionsAvailable: boolean };
type FormValues = Record<Exclude<keyof G1AssessmentPayload, "proposedCapAmount" | "proposedCapCurrency" | "nextOwnerProfileId">, string>
  & { proposedCapAmount: string; proposedCapCurrency: string; nextOwnerProfileId: string };
const fields: Array<{ key: keyof FormValues; label: string; help: string }> = [
  { key: "strategicRationale", label: "Strategic fit", help: "Why does this opportunity fit the organization’s direction?" },
  { key: "customerRationale", label: "Customer rationale", help: "What customer outcome justifies evaluation?" },
  { key: "technicalAssessment", label: "Technical assessment", help: "The required trial discipline assessment and its basis." },
  { key: "technicalRisk", label: "Technical risk", help: "Identify the material technical risk or explain why none is known." },
  { key: "capacityPosition", label: "Capacity position", help: "What people, time and access are available or uncertain?" },
  { key: "commercialRisk", label: "Indicative commercial risk", help: "Describe terms, exposure and unknowns without approving spend." },
  { key: "pursuitPlan", label: "Proposed pursuit plan", help: "What would the team do next if qualification is granted?" },
  { key: "knownUnknowns", label: "Known unknowns", help: "Optional; name open questions and who will resolve them." },
];
const labels = Object.fromEntries(fields.map(field => [field.key, field.label])) as Record<string, string>;
labels.proposedCapAmount = "Proposed pursuit cap";
labels.proposedCapCurrency = "Cap currency";
labels.nextOwnerProfileId = "Next owner";

function formValues(payload?: G1AssessmentPayload | null): FormValues {
  return {
    strategicRationale: payload?.strategicRationale ?? "",
    customerRationale: payload?.customerRationale ?? "",
    technicalAssessment: payload?.technicalAssessment ?? "",
    technicalRisk: payload?.technicalRisk ?? "",
    capacityPosition: payload?.capacityPosition ?? "",
    commercialRisk: payload?.commercialRisk ?? "",
    pursuitPlan: payload?.pursuitPlan ?? "",
    knownUnknowns: payload?.knownUnknowns ?? "",
    proposedCapAmount: payload?.proposedCapAmount == null ? "" : String(payload.proposedCapAmount),
    proposedCapCurrency: payload?.proposedCapCurrency ?? "",
    nextOwnerProfileId: payload?.nextOwnerProfileId ?? "",
  };
}
function payloadFrom(values: FormValues): G1AssessmentPayload {
  const text = (value: string) => value.trim() || null;
  return {
    strategicRationale: text(values.strategicRationale), customerRationale: text(values.customerRationale),
    technicalAssessment: text(values.technicalAssessment), technicalRisk: text(values.technicalRisk),
    capacityPosition: text(values.capacityPosition), commercialRisk: text(values.commercialRisk),
    pursuitPlan: text(values.pursuitPlan), knownUnknowns: text(values.knownUnknowns),
    proposedCapAmount: values.proposedCapAmount.trim() === "" ? null : Number(values.proposedCapAmount),
    proposedCapCurrency: values.proposedCapCurrency as G1AssessmentPayload["proposedCapCurrency"] || null,
    nextOwnerProfileId: values.nextOwnerProfileId || null,
  };
}

export function G1AssessmentWorkspace({ workId, context, ownerOptions, ownerOptionsAvailable,
  decisionStatus, returnReason }: Props & { decisionStatus?: "returned" | "qualified" | "pending_decision" | "preparing" | "not_started";
    returnReason?: string | null }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => formValues(context.payload));
  const [revision, setRevision] = useState(context.assessmentRevision ?? 0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [pending, setPending] = useState<{ commandId: string; mode: "save" | "submit"; payload: G1AssessmentPayload } | null>(null);

  if (context.status === "not_started") return null;
  if (context.status === "draft_private") return <div className={styles.notice}>The capture author is preparing a G1 assessment. Its draft content is private until submission.</div>;
  if (context.status === "submitted") return <section className={styles.workspace} aria-label="Submitted G1 assessment">
    <h3>Submitted assessment · {decisionStatus === "qualified" ? "trial pursuit qualified"
      : decisionStatus === "returned" ? "returned for correction" : "decision pending"}</h3>
    <p>Revision {context.assessmentRevision} is frozen. {decisionStatus === "qualified"
      ? "The separate trial G1 decision qualified pursuit under its synthetic rule; spending remains unauthorized."
      : decisionStatus === "returned" ? "The author can open a new correction draft below."
        : "A separate decision is pending; this submission is not qualification or spending approval."}</p>
    {context.strategyResult ? <p><strong>Frozen strategy check:</strong> {context.strategyResult.status}
      {context.strategyResult.reason ? ` · ${context.strategyResult.reason}` : ""}</p>
      : <p>This historical submitted package has no pinned strategy check.</p>}
    <dl>{fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{context.payload?.[field.key] || "Not recorded"}</dd></div>)}
      <div><dt>Proposed pursuit cap</dt><dd>{context.payload?.proposedCapAmount ?? "Not recorded"} {context.payload?.proposedCapCurrency ?? ""} · proposal only</dd></div>
      <div><dt>Proposed next owner</dt><dd>{context.nextOwnerName ?? ownerOptions.find(x => x.profileId === context.payload?.nextOwnerProfileId)?.label ?? "Not recorded"}</dd></div></dl>
    <p className={styles.digest}>Frozen package digest {context.packageDigest}</p>
  </section>;
  if (!context.canEdit || !context.g1InstanceId) return <div className={styles.notice}>Assessment preparation is unavailable to this identity.</div>;

  function change(key: keyof FormValues, value: string) {
    setValues(previous => ({ ...previous, [key]: value }));
    setFeedback(""); setMissing([]);
  }
  async function run(mode: "save" | "submit", retry = false) {
    if (busy || !context.g1InstanceId) return;
    const next = retry && pending ? pending
      : { commandId: `d5o-g1-assessment-${crypto.randomUUID()}`, mode, payload: payloadFrom(values) };
    if (!retry && mode === "submit") {
      const required = fields.filter(field => field.key !== "knownUnknowns" && values[field.key].trim().length < 20)
        .map(field => field.key);
      if (values.proposedCapAmount.trim() === "" || !Number.isFinite(Number(values.proposedCapAmount))
        || Number(values.proposedCapAmount) < 0) required.push("proposedCapAmount");
      if (!values.proposedCapCurrency) required.push("proposedCapCurrency");
      if (!values.nextOwnerProfileId) required.push("nextOwnerProfileId");
      if (required.length) { setMissing(required); setFeedback("Complete the marked assessment fields before submission. A partial draft can still be saved."); return; }
    }
    setPending(next); setBusy(true); setFeedback(""); setMissing([]);
    let result: G1AssessmentWriteResult;
    try { result = await writeG1AssessmentAction({ workId, instanceId: context.g1InstanceId,
      expectedRevision: revision, ...next }); }
    catch { result = { status: "unavailable" }; }
    setBusy(false);
    if (result.status === "saved" || result.status === "submitted") {
      setPending(null); setRevision(result.assessmentRevision);
      setFeedback(result.status === "submitted" ? "Assessment submitted and frozen for decision review. No qualification or spending decision was made."
        : "Assessment draft saved. It remains editable and is not in the decision queue.");
      router.refresh();
    } else if (result.status === "incomplete") {
      setPending(null); setMissing(result.missing);
      setFeedback("The assessment is incomplete. Review the marked fields; your entries remain here.");
    } else if (result.status === "unavailable") {
      setFeedback("The save result is unknown. Retry the same command; do not start a new submission.");
    } else {
      setPending(null);
      setFeedback(result.status === "conflict" ? "This assessment changed. Copy your entries, then refresh before saving."
        : result.status === "denied" ? "You no longer have authority to prepare this assessment."
          : "Review the assessment values and scoped next owner.");
    }
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void run("submit"); }
  return <section className={styles.workspace} aria-label="G1 assessment form">
    <h3>Prepare the G1 package</h3>
    {returnReason ? <p className={styles.feedback}><strong>Reviewer correction:</strong> {returnReason}</p> : null}
    <p>Record the case for selecting this opportunity. Save partial work, then submit a complete package for a separate G1 decision. The cap below is a proposal, not spending authority.</p>
    <p className={styles.revision}>Draft revision {revision}</p>
    <form onSubmit={onSubmit}>
      <div className={styles.fields}>{fields.map(field => <label key={field.key} className={styles.field}>
        <span>{field.label}{field.key === "knownUnknowns" ? " · optional" : ""}</span>
        <small>{field.help}</small>
        <textarea value={values[field.key]} maxLength={2000} rows={3} disabled={busy || !!pending}
          aria-invalid={missing.includes(field.key)} onChange={event => change(field.key, event.target.value)} />
      </label>)}</div>
      <div className={styles.bottom}>
        <label className={styles.field}><span>Proposed pursuit cap</span><small>Amount proposed for later authorization. Zero is allowed, but it is not a spend decision.</small>
          <input type="number" min="0" max="1000000000" step="0.01" value={values.proposedCapAmount}
            disabled={busy || !!pending} aria-invalid={missing.includes("proposedCapAmount")}
            onChange={event => change("proposedCapAmount", event.target.value)} /></label>
        <label className={styles.field}><span>Currency</span><select value={values.proposedCapCurrency}
          disabled={busy || !!pending} aria-invalid={missing.includes("proposedCapCurrency")}
          onChange={event => change("proposedCapCurrency", event.target.value)}><option value="">Choose currency</option>
          <option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option></select></label>
        <label className={styles.field}><span>Named next owner</span><select value={values.nextOwnerProfileId}
          disabled={busy || !!pending || !ownerOptionsAvailable} aria-invalid={missing.includes("nextOwnerProfileId")}
          onChange={event => change("nextOwnerProfileId", event.target.value)}><option value="">Choose a scoped owner</option>
          {ownerOptions.map(owner => <option key={owner.profileId} value={owner.profileId}>{owner.label}</option>)}</select>
          {!ownerOptionsAvailable ? <small>Owner options are unavailable; submission is blocked until they load.</small> : null}</label>
      </div>
      {feedback ? <p role={pending ? "alert" : "status"} className={styles.feedback}>{feedback}</p> : null}
      {missing.length ? <p className={styles.missing}>Needed: {missing.map(key => labels[key] ?? key).join(", ")}.</p> : null}
      <div className={styles.actions}>
        {pending ? <button type="button" disabled={busy} onClick={() => void run(pending.mode, true)}>Retry same command</button> : <>
          <button type="button" disabled={busy} onClick={() => void run("save")}>Save draft</button>
          <button type="submit" disabled={busy || !ownerOptionsAvailable}>Submit for G1 review</button>
        </>}
      </div>
    </form>
  </section>;
}
