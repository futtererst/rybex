"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  captureCreateIssues,
  normalizeCaptureDraft,
  type CaptureDraft,
  type CaptureIssue,
} from "@/lib/d5o/discover/capture-contract";
import type { OwnCaptureView } from "@/lib/d5o/discover/capture-read";
import styles from "./OpportunityCapture.module.css";

export type CaptureCandidate = { workId: string; title: string; customerContext: string | null; siteContext: string | null; lifecycleState: string };
export type CaptureSaveResult =
  | { status: "saved"; workId: string; recordVersion: number; replayed: boolean }
  | { status: "conflict" | "denied" | "invalid" | "configuration_unavailable"; message?: string }
  | { status: "unknown_outcome"; retrySameCommand: true };

type Props = {
  initialView?: OwnCaptureView | null;
  ownerOptions: { profileId: string; label: string }[];
  ownerOptionsStatus?: "loading" | "ok" | "denied" | "unavailable";
  findCandidates: (customerContext: string, title: string) => Promise<
    | { status: "ok"; candidates: CaptureCandidate[]; legacyMatchPossible: boolean }
    | { status: "denied" | "unavailable" | "invalid" }
  >;
  saveDraft: (input: { commandId: string; draft: CaptureDraft }) => Promise<CaptureSaveResult>;
  onSaved: (workId: string) => void;
  onClose: () => void;
};

const issueLabels: Record<CaptureIssue, string> = {
  title_required: "Name the opportunity to save a draft.",
  title_too_long: "Use a shorter opportunity name.",
  field_too_long: "One or more entries exceed the allowed length.",
  invalid_enum: "Choose a valid listed value.",
  invalid_date: "Enter a valid calendar date.",
  currency_required: "Choose a currency for an indicative value range.",
  duplicate_unresolved: "Possible existing work blocks a new Work ID until a scoped review is available. Open the existing record or keep this draft outside the system.",
  duplicate_reason_required: "Explain why this is a distinct customer need.",
  customer_identity_required: "Link an authorized customer before triage.",
  site_identity_required: "Link an authorized site before triage.",
  need_required: "Describe the customer need before triage.",
  source_required: "Record how this lead arrived before triage.",
  triage_owner_required: "Assign an authorized commercial triage owner.",
};

const initial = {
  title: "", customerContext: "", siteContext: "", source: "", sourceReference: "",
  needSummary: "", workType: "", contactContext: "", valueBand: "unknown", currency: "",
  responseDueOn: "", procurement: "", triageOwnerProfileId: "", nextAction: "",
  duplicateDisposition: "unreviewed", duplicateReason: "",
};

function editableValues(view?: OwnCaptureView | null): typeof initial {
  if (!view) return initial;
  const draft = view.draft;
  return {
    title: draft.title, customerContext: draft.customerContext ?? "", siteContext: draft.siteContext ?? "",
    source: draft.source ?? "", sourceReference: draft.sourceReference ?? "",
    needSummary: draft.needSummary ?? "", workType: draft.workType ?? "",
    contactContext: draft.contactContext ?? "", valueBand: draft.valueBand,
    currency: draft.currency ?? "", responseDueOn: draft.responseDueOn ?? "",
    procurement: draft.procurement ?? "", triageOwnerProfileId: draft.triageOwnerProfileId ?? "",
    nextAction: draft.nextAction ?? "", duplicateDisposition: draft.duplicateDisposition,
    duplicateReason: draft.duplicateReason ?? "",
  };
}

export function OpportunityCapture({ initialView, ownerOptions, ownerOptionsStatus = "ok", findCandidates, saveDraft, onSaved, onClose }: Props) {
  const editing = Boolean(initialView);
  const [values, setValues] = useState(() => editableValues(initialView));
  const [candidates, setCandidates] = useState<CaptureCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CaptureCandidate | null>(null);
  const [candidateReview, setCandidateReview] = useState<"idle" | "loading" | "missing" | "denied" | "unavailable">("idle");
  const [legacyMatchPossible, setLegacyMatchPossible] = useState(false);
  const [lookup, setLookup] = useState<"idle" | "loading" | "ok" | "denied" | "unavailable">("idle");
  const [issues, setIssues] = useState<CaptureIssue[]>([]);
  const [outcome, setOutcome] = useState<CaptureSaveResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const pending = useRef<{ commandId: string; draft: CaptureDraft } | null>(null);
  const candidateRevision = useRef(0);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const customer = values.customerContext.trim();
    if (customer.length < 3) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      setLookup("loading");
      try {
        const result = await findCandidates(customer, values.title.trim());
        if (!current) return;
        setLookup(result.status === "invalid" ? "unavailable" : result.status);
        setCandidates(result.status === "ok" ? result.candidates.filter(candidate => candidate.workId !== initialView?.workId) : []);
        setLegacyMatchPossible(result.status === "ok" ? result.legacyMatchPossible : false);
      } catch {
        if (current) { setLookup("unavailable"); setCandidates([]); setLegacyMatchPossible(false); }
      }
    }, 300);
    return () => { current = false; window.clearTimeout(timer); };
  }, [values.customerContext, values.title, findCandidates, initialView?.workId]);

  function change(key: keyof typeof initial, value: string) {
    if (outcome?.status === "unknown_outcome") return;
    if (key === "customerContext" || key === "title") {
      candidateRevision.current += 1;
      setSelectedCandidate(null); setCandidateReview("idle");
      setCandidates([]); setLegacyMatchPossible(false);
      const customer = key === "customerContext" ? value : values.customerContext;
      setLookup(customer.trim().length >= 3 ? "loading" : "idle");
    }
    setValues(previous => ({ ...previous, [key]: value,
      ...(key === "customerContext" ? { duplicateDisposition: "unreviewed", duplicateReason: "" } : {}) }));
    setIssues([]); setOutcome(null); setDirty(true); pending.current = null;
  }

  async function selectCandidate(candidate: CaptureCandidate) {
    const request = ++candidateRevision.current;
    setSelectedCandidate(null); setCandidateReview("loading");
    try {
      // Re-read through the same separate scoped right; never trust an old search card.
      const result = await findCandidates(values.customerContext.trim(), values.title.trim());
      if (request !== candidateRevision.current) return;
      if (result.status !== "ok") {
        setCandidateReview(result.status === "denied" ? "denied" : "unavailable");
        setLookup(result.status === "denied" ? "denied" : "unavailable");
        setCandidates([]);
        return;
      }
      const current = result.candidates.find(item => item.workId === candidate.workId);
      if (!current) { setCandidateReview("missing"); setCandidates([]); setLookup("unavailable"); return; }
      setSelectedCandidate(current); setCandidateReview("idle");
      setCandidates(result.candidates.filter(item => item.workId !== initialView?.workId));
      setLegacyMatchPossible(result.legacyMatchPossible);
    } catch {
      if (request === candidateRevision.current) {
        setCandidateReview("unavailable"); setLookup("unavailable"); setCandidates([]);
      }
    }
  }

  async function submit(retry = false) {
    if (saving) return;
    if (!retry && (lookup === "loading" || lookup === "unavailable" || lookup === "denied")) {
      setOutcome({ status: "configuration_unavailable", message: "The scoped duplicate check is unavailable. No draft was created." });
      return;
    }
    let command = pending.current;
    if (!retry || !command) {
      const parsed = normalizeCaptureDraft(values);
      if (!parsed.ok) { setIssues(parsed.issues); if (parsed.issues.includes("title_required")) titleRef.current?.focus(); return; }
      const duplicateIssues = captureCreateIssues(parsed.draft, { possibleDuplicate: candidates.length > 0 || legacyMatchPossible });
      if (duplicateIssues.length) { setIssues(duplicateIssues); return; }
      command = { commandId: crypto.randomUUID(), draft: parsed.draft };
      pending.current = command;
    }
    setSaving(true); setIssues([]);
    try {
      const result = await saveDraft(command);
      setOutcome(result);
      if (result.status === "saved") { setDirty(false); onSaved(result.workId); }
      if (result.status !== "unknown_outcome") pending.current = null;
    } catch {
      // A committed write may have lost its response. Keep the exact command for reconciliation.
      setOutcome({ status: "unknown_outcome", retrySameCommand: true });
    } finally { setSaving(false); }
  }

  function close() {
    if (outcome?.status === "unknown_outcome") return;
    if (dirty && !window.confirm("Discard this unsaved opportunity draft?")) return;
    onClose();
  }

  const locked = saving || outcome?.status === "unknown_outcome" || outcome?.status === "saved";
  return (
    <div className={styles.shell} data-d5o-capture="crm-v3">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Discover / opportunity capture</p><h1>{editing ? "Edit opportunity draft" : "New opportunity"}</h1>
          <p>{editing ? `Work ${initialView?.workId} · version ${initialView?.recordVersion}. Save changes to this same record before commercial triage.` : "Record the customer need and enough context for commercial triage. Return to an incomplete draft later."}</p></div>
        <button type="button" className={styles.close} onClick={close} disabled={outcome?.status === "unknown_outcome"} aria-label="Close opportunity capture">×</button>
      </header>
      <div className={styles.scroll}>
        <div className={styles.layout}>
          <form id="discover-capture-form" className={styles.form} onSubmit={event => { event.preventDefault(); void submit(); }}>
            <fieldset disabled={locked} className={styles.fieldset}>
              <section className={styles.section}><SectionHeading number="01" title="Identify the opportunity" description="Give the team a recognizable lead and link its source." />
                <div className={styles.fields}>
                  <Field label="Opportunity name" required wide><input ref={titleRef} value={values.title} onChange={event => change("title", event.target.value)} placeholder="e.g. Plant cooling renewal" maxLength={240} /></Field>
                  <Field label="Account / customer" help="Unmatched names remain unverified until triage."><input value={values.customerContext} onChange={event => change("customerContext", event.target.value)} placeholder="Search or enter customer" /></Field>
                  <Field label="Site / location" help="Leave blank if it is not known yet."><input value={values.siteContext} onChange={event => change("siteContext", event.target.value)} placeholder="Known site or location" /></Field>
                  <Field label="How did this arrive?"><select value={values.source} onChange={event => change("source", event.target.value)}><option value="">Select source</option><option value="customer_request">Customer request</option><option value="referral">Referral</option><option value="tender_invitation">Tender invitation</option><option value="crm_reference">Existing CRM reference</option><option value="lifecycle_lead">Internal lifecycle lead</option></select></Field>
                  <Field label="Source reference" help="A typed reference does not import external truth."><input value={values.sourceReference} onChange={event => change("sourceReference", event.target.value)} placeholder="Email, tender, or CRM ID" /></Field>
                </div></section>
              <section className={styles.section}><SectionHeading number="02" title="Understand the customer need" description="Capture the outcome before estimating a solution." />
                <div className={styles.fields}>
                  <Field label="Customer need / desired outcome" wide><textarea value={values.needSummary} onChange={event => change("needSummary", event.target.value)} rows={3} placeholder="What does the customer need to change or achieve?" /></Field>
                  <Field label="Potential work type"><select value={values.workType} onChange={event => change("workType", event.target.value)}><option value="">Unknown yet</option><option value="project">Project</option><option value="service">Service</option><option value="assessment">Assessment / discovery</option><option value="lifecycle_follow_up">Lifecycle follow-up</option></select></Field>
                  <Field label="Customer contact / role" help="No external user account is created."><input value={values.contactContext} onChange={event => change("contactContext", event.target.value)} placeholder="Name and role, if verified" /></Field>
                </div></section>
              <section className={styles.section}><SectionHeading number="03" title="Size the opportunity" description="Early estimates help selection; unknown values are valid." />
                <div className={styles.fields}>
                  <Field label="Indicative value range" help="An estimate is not an approved budget."><select value={values.valueBand} onChange={event => change("valueBand", event.target.value)}><option value="unknown">Unknown</option><option value="below_100k">Below 100k</option><option value="100k_250k">100k–250k</option><option value="250k_500k">250k–500k</option><option value="above_500k">Above 500k</option></select></Field>
                  <Field label="Currency"><select value={values.currency} onChange={event => change("currency", event.target.value)}><option value="">Unknown</option><option>USD</option><option>GBP</option><option>EUR</option></select></Field>
                  <Field label="Customer response deadline"><input type="date" value={values.responseDueOn} onChange={event => change("responseDueOn", event.target.value)} /></Field>
                  <Field label="Procurement route"><select value={values.procurement} onChange={event => change("procurement", event.target.value)}><option value="">Unknown</option><option value="direct">Direct request</option><option value="competitive_tender">Competitive tender</option><option value="existing_agreement">Existing agreement</option><option value="paid_discovery">Paid discovery proposed</option></select></Field>
                </div></section>
              <section className={styles.section}><SectionHeading number="04" title="Set the next owner" description="Triage ownership is a responsibility, not a pursuit approval." />
                <div className={styles.fields}>
                  <Field label="Proposed commercial triage owner" help="A proposal is not acceptance. The owner must accept a later assignment."><select value={values.triageOwnerProfileId} disabled={ownerOptionsStatus !== "ok"} onChange={event => change("triageOwnerProfileId", event.target.value)}><option value="">Unassigned — needs routing</option>{values.triageOwnerProfileId && !ownerOptions.some(owner => owner.profileId === values.triageOwnerProfileId) ? <option value={values.triageOwnerProfileId}>Previously proposed owner — revalidation needed</option> : null}{ownerOptions.map(owner => <option key={owner.profileId} value={owner.profileId}>{owner.label}</option>)}</select>{ownerOptionsStatus === "loading" ? <small role="status">Loading eligible owners…</small> : null}{ownerOptionsStatus === "denied" ? <small role="alert">Eligible owners are unavailable to this identity.</small> : null}{ownerOptionsStatus === "unavailable" ? <small role="alert">Owner routing is unavailable. Save a partial draft and retry later.</small> : null}{ownerOptionsStatus === "ok" && ownerOptions.length === 0 ? <small role="status">No eligible commercial owner is configured for this workspace.</small> : null}</Field>
                  <Field label="Immediate follow-up"><input value={values.nextAction} onChange={event => change("nextAction", event.target.value)} placeholder="e.g. Confirm buyer and site" /></Field>
                </div></section>
            </fieldset>
          </form>
          <aside className={styles.guide} aria-label="Capture guidance">
            <div className={styles.card}><p className={styles.eyebrow}>Capture status</p><h2>Draft first</h2><p>Saving starts one Work ID. It does not qualify pursuit or authorize spending.</p>
              <Check done={Boolean(values.title.trim())}>Opportunity named</Check><Check done={Boolean(values.customerContext.trim())}>Customer identified provisionally</Check><Check done={Boolean(values.needSummary.trim())}>Customer need described</Check><Check done={Boolean(values.triageOwnerProfileId)}>Triage owner selected</Check></div>
            <div className={styles.card}><p className={styles.eyebrow}>Duplicate check</p><h2>{candidates.length || legacyMatchPossible ? "Possible existing work" : "Search existing work"}</h2>
                {lookup === "loading" ? <p>Checking scoped work…</p> : lookup === "unavailable" || lookup === "denied" ? <p>The scoped check is unavailable. A new Work ID is blocked.</p> : candidates.length || legacyMatchPossible ? <><p>Review these before creating another Work ID.</p>{candidates.map(candidate => <button key={candidate.workId} type="button" className={styles.candidate} onClick={() => void selectCandidate(candidate)} aria-label={`Review existing Work ${candidate.workId}`}><strong>{candidate.title}</strong><span>{candidate.customerContext || "Customer unverified"} · {candidate.siteContext || "Site unconfirmed"}</span></button>)}
                {candidateReview === "loading" ? <p role="status">Rechecking selected Work ID and access…</p> : candidateReview === "missing" ? <p role="alert">This match changed or is no longer visible. A new Work ID remains blocked; search again.</p> : candidateReview === "denied" || candidateReview === "unavailable" ? <p role="alert">The selected match could not be revalidated. A new Work ID remains blocked.</p> : null}
                {selectedCandidate ? <div className={styles.selectedCandidate} role="region" aria-label="Selected existing opportunity"><strong>Existing Work {selectedCandidate.workId}</strong><p>{selectedCandidate.title}</p><dl><div><dt>Customer</dt><dd>{selectedCandidate.customerContext || "Unverified"}</dd></div><div><dt>Site</dt><dd>{selectedCandidate.siteContext || "Unconfirmed"}</dd></div><div><dt>State</dt><dd>{selectedCandidate.lifecycleState}</dd></div></dl><p>This read-only summary was rechecked under the candidate-review right. Keep this Work ID for an attributable scoped review; no duplicate disposition or new record has been made.</p></div> : null}
                {legacyMatchPossible ? <p>An older opportunity may match. Its source identity has not been linked to a Work ID, so this intake stays on hold for a scoped review.</p> : null}
                <p>A possible match blocks creation. Marking it distinct here does not clear that hold.</p>
                <Field label="Disposition"><select value={values.duplicateDisposition} disabled={locked} onChange={event => change("duplicateDisposition", event.target.value)}><option value="unreviewed">Choose after reviewing</option><option value="same_work">Same work — use existing ID</option><option value="distinct">Distinct customer need — review required</option></select></Field>
                {values.duplicateDisposition === "distinct" ? <Field label="Reason this is distinct"><textarea value={values.duplicateReason} disabled={locked} onChange={event => change("duplicateReason", event.target.value)} rows={2} /></Field> : null}</> : <p>Enter a customer to check for existing scoped work. A no-match preview is not final proof.</p>}</div>
            <div className={styles.card}><p className={styles.eyebrow}>Next boundary</p><h2>Commercial triage</h2><p>A scoped owner verifies identity and chooses whether this lead merits evaluation. G1 pursuit and spending are later decisions.</p></div>
          </aside>
        </div>
      </div>
      <footer className={styles.footer}>
        <div aria-live="polite"><strong>{outcome?.status === "saved" ? `Draft saved · Work ${outcome.workId}` : outcome?.status === "unknown_outcome" ? "Outcome uncertain" : issues.length ? "Draft needs attention" : dirty ? "Unsaved changes" : "Unsaved draft"}</strong>
          <small>{outcome?.status === "unknown_outcome" ? "Retry the same command; do not create another draft." : outcome?.status === "conflict" || outcome?.status === "denied" || outcome?.status === "invalid" || outcome?.status === "configuration_unavailable" ? outcome.message ?? "No confirmed draft receipt was returned." : issues.length ? issues.map(issue => issueLabels[issue]).join(" ") : editing ? "Changes save to this Work ID only. A stale version will be refused." : "Only the opportunity name is required for a partial draft."}</small></div>
        {outcome?.status === "unknown_outcome" ? <button type="button" className={styles.primary} disabled={saving} onClick={() => void submit(true)}>Retry same command</button> : <button type="submit" form="discover-capture-form" className={styles.primary} disabled={locked}>{editing ? "Save changes" : "Save draft"}</button>}
      </footer>
    </div>
  );
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className={styles.sectionHeading}><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>;
}
function Field({ label, help, required, wide, children }: { label: string; help?: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return <label className={`${styles.field} ${wide ? styles.wide : ""}`}><span>{label}{required ? <b aria-label="required"> *</b> : null}</span>{children}{help ? <small>{help}</small> : null}</label>;
}
function Check({ done, children }: { done: boolean; children: ReactNode }) {
  return <div className={`${styles.check} ${done ? styles.done : ""}`}>{done ? "✓" : "○"} {children}</div>;
}
