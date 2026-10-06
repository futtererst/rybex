"use client";

import { useState } from "react";
import type { DefinitionRecord, WorkRecord } from "./work-types";
import type { WorkspaceKey } from "./work-types";
import { ConfiguredPhasePanel } from "./ConfiguredPhasePanel";
import { DefinitionRegister } from "./DefinitionRegister";
import { evaluateRule } from "./phase-configuration";
import { resolvePublishedPhaseConfiguration } from "./published-phase-configuration";
import type { ConfigurationInventory } from "@/lib/d5o/configuration/version-inventory";
import styles from "./DefineWorkspace.module.css";
import { WorkPhaseJourney, type WorkPhase, type WorkControl } from "./WorkPhaseJourney";

type Section = "scope" | "delivery" | "commercial" | "risks";
const sections: Array<{ key: Section; label: string }> = [
  { key: "scope", label: "Outcome & scope" },
  { key: "delivery", label: "Delivery design" },
  { key: "commercial", label: "Commercial dependency" },
  { key: "risks", label: "Risks & handoff" },
];
const now = () => new Date().toISOString();
const initial = (work: WorkRecord): DefinitionRecord => ({
  revision: 1, status: "Draft", outcome: "", acceptance: "", includedScope: "", excludedScope: "",
  deliveryApproach: "", milestones: "", dependencies: "", estimateBasis: "", commercialTerms: "",
  risks: "", owner: work.owner, history: [],
});

export function DefineWorkspace({ workspaceKey, configurationInventory, work, focusRecordId, reviewFocus, onReviewQueued, onOpen, onPhase, onControl, onBack, onSelect, onUpdate, onNotice }: {
  workspaceKey: WorkspaceKey;
  workspaceName: string;
  configurationInventory: ConfigurationInventory;
  work: WorkRecord[];
  focusRecordId?: string;
  reviewFocus?: "commercial" | "delivery" | null;
  onReviewQueued: () => void;
  onOpen: (work: WorkRecord) => void;
  onPhase: (work: WorkRecord, phase: WorkPhase) => void;
  onControl: (work: WorkRecord, control: WorkControl) => void;
  onBack: () => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, transform: (work: WorkRecord) => WorkRecord) => void;
  onNotice: (notice: string) => void;
}) {
  const candidates = work.filter((item) => item.discovery?.pursuitControl
    ? item.discovery.pursuitControl.handoff?.status === "accepted"
    : item.definition || item.discovery?.fit === "Qualified" || item.discovery?.fit === "Conditional" || item.discovery?.outcome === "Won");
  const [section, setSection] = useState<Section>(reviewFocus ? "risks" : "scope");
  const [reviewNote, setReviewNote] = useState("");
  const selected = candidates.find((item) => item.id === focusRecordId) ?? candidates[0];
  const definition = selected ? selected.definition ?? initial(selected) : undefined;
  const config = selected ? resolvePublishedPhaseConfiguration(configurationInventory, workspaceKey, selected.type, selected) : null;
  const definePhase = config?.phases.find((item) => item.key === "define");
  const commercialRequired = Boolean(definePhase?.components.some((item) => item.key === "commercial_source"));
  const visibleSections = commercialRequired ? sections : sections.filter((item) => item.key !== "commercial");
  const configuredRules = definePhase?.components.flatMap((item) => item.rules ?? []).filter((item) => item.requiredAt === "review") ?? [];
  const missing = selected ? configuredRules.filter((item) => !evaluateRule(selected, item)) : [];
  const complete = configuredRules.length - missing.length;
  const sourceChanged = (definition?.status === "In review" || definition?.status === "Approved") && (
    (commercialRequired && (definition.sourceEstimateRevision !== selected?.discovery?.estimate.revision ||
    definition.sourceProposalRevision !== selected?.discovery?.proposal.package?.revision ||
    selected?.discovery?.estimate.status !== "Approved")) ||
    definition.configurationVersion !== config?.version ||
    definition.configurationWorkTypeKey !== config?.workTypeKey
  );
  const locked = definition?.status === "In review" || definition?.status === "Approved";
  const inReview = candidates.filter((item) => item.definition?.status === "In review").length;
  const ready = candidates.filter((item) => { const pinned = resolvePublishedPhaseConfiguration(configurationInventory, workspaceKey, item.type, item); const requiresCommercial = pinned?.phases.find((phase) => phase.key === "define")?.components.some((component) => component.key === "commercial_source"); return item.definition?.status === "Approved" && (!requiresCommercial || item.definition.sourceEstimateRevision === item.discovery?.estimate.revision && item.definition.sourceProposalRevision === item.discovery?.proposal.package?.revision && item.discovery?.estimate.status === "Approved") && item.definition.configurationVersion === pinned?.version && item.definition.configurationWorkTypeKey === pinned?.workTypeKey; }).length;

  function saveField(key: keyof DefinitionRecord, value: string) {
    if (!selected || !definition || locked) return;
    const newRevision = definition.status === "Changes requested";
    onUpdate(selected.id, (current) => ({ ...current, definition: {
      ...definition, [key]: value, status: "Draft", revision: newRevision ? definition.revision + 1 : definition.revision,
      reviews: newRevision ? undefined : definition.reviews,
      history: newRevision ? [...definition.history, { at: now(), revision: definition.revision + 1, event: "New revision started", note: "Changes requested by a reviewer." }] : definition.history,
    } }));
  }

  function saveRegister(key: string, rows: Array<Record<string, string>>) {
    if (!selected || !definition || locked) return;
    const newRevision = definition.status === "Changes requested";
    const legacyKey: Record<string, "includedScope" | "acceptance" | "milestones" | "dependencies" | "risks"> = { scope_items: "includedScope", acceptance_criteria: "acceptance", milestones: "milestones", dependencies: "dependencies", risks: "risks" };
    if (!legacyKey[key]) { onNotice("This register has no compatible definition binding."); return; }
    const summary = rows.map((row) => Object.entries(row).filter(([field]) => field !== "id").map(([, value]) => value).filter(Boolean).join(" · ")).join("; ");
    onUpdate(selected.id, (current) => ({ ...current, definition: {
      ...definition, registers: { ...definition.registers, [key]: rows }, [legacyKey[key]]: summary,
      status: "Draft", revision: newRevision ? definition.revision + 1 : definition.revision,
      reviews: newRevision ? undefined : definition.reviews,
      history: newRevision ? [...definition.history, { at: now(), revision: definition.revision + 1, event: "New revision started", note: "Changes requested by a reviewer." }] : definition.history,
    } }));
  }

  const register = (key: string) => {
    const component = definePhase?.components.find((item) => item.key === key);
    return component ? <DefinitionRegister key={key} component={component} rows={definition?.registers?.[key] ?? []} disabled={Boolean(locked)} onChange={(rows) => saveRegister(key, rows)} /> : null;
  };

  function submit() {
    if (!selected || !definition) return;
    if (!config || !definePhase) { onNotice("No compatible reference configuration exists for this Work Type and workspace."); return; }
    if (missing.length) { onNotice(`Complete ${missing.length} required definition ${missing.length === 1 ? "item" : "items"} before requesting review.`); return; }
    if (definition.status !== "Draft") return;
    const next: DefinitionRecord = {
      ...definition, status: "In review", sourceEstimateRevision: commercialRequired ? selected.discovery?.estimate.revision : undefined, sourceProposalRevision: commercialRequired ? selected.discovery?.proposal.package?.revision : undefined, configurationVersion: config.version, configurationWorkTypeKey: config.workTypeKey, reviews: { commercial: "Pending", delivery: "Pending", revision: definition.revision },
      history: [...definition.history, { at: now(), revision: definition.revision, event: "Review requested", note: `Submitted to synthetic Commercial and Delivery role queues against ${config.workTypeKey}@${config.version}${commercialRequired ? `, estimate revision ${selected.discovery?.estimate.revision ?? "none"}, proposal revision ${selected.discovery?.proposal.package?.revision ?? "none"}` : "; no Develop price prerequisite"}.` }],
    };
    onUpdate(selected.id, (current) => ({ ...current, definition: next }));
    onNotice(`Definition revision ${next.revision} sent to the synthetic Commercial and Delivery role queues.`);
  }

  function decide(role: "commercial" | "delivery", decision: "Approved" | "Changes requested") {
    if (!selected || !definition?.reviews || definition.status !== "In review") return;
    if (!config || !definePhase || sourceChanged || missing.length) { onNotice("The governing configuration, requirements or referenced source changed. Start a new definition revision before deciding."); return; }
    if (definition.reviews[role] !== "Pending") return;
    if (!reviewNote.trim()) { onNotice("Record the decision basis before deciding."); return; }
    const reviews = { ...definition.reviews, [role]: decision };
    const status = decision === "Changes requested" ? "Changes requested" : reviews.commercial === "Approved" && reviews.delivery === "Approved" ? "Approved" : "In review";
    const next: DefinitionRecord = {
      ...definition, status, reviews,
      history: [...definition.history, { at: now(), revision: definition.revision, event: `${role === "commercial" ? "Commercial" : "Delivery"} review · ${decision}`, note: reviewNote.trim() }],
    };
    onUpdate(selected.id, (current) => ({
      ...current, definition: next,
      ...(status === "Approved" ? { nextAction: commercialRequired ? "Review authorization and readiness" : "Develop solution, estimate and offer", history: [`${now()} · Definition revision ${next.revision} approved${commercialRequired ? " for authorization review" : " for Develop work"}`, ...current.history] } : {}),
    }));
    setReviewNote("");
    onNotice(status === "Approved" ? commercialRequired ? "The definition baseline is approved for authorization review. Delivery is not authorized by this decision." : "The scope baseline is approved for Develop. An offer, award and delivery still require separate decisions." : `${role === "commercial" ? "Commercial" : "Delivery"} decision recorded against revision ${next.revision}.`);
  }

  function refreshSource() {
    if (!selected || !definition || !sourceChanged) return;
    onUpdate(selected.id, (current) => ({ ...current, definition: { ...definition, revision: definition.revision + 1, status: "Draft", reviews: undefined, sourceEstimateRevision: undefined, sourceProposalRevision: undefined, configurationVersion: undefined, configurationWorkTypeKey: undefined, history: [...definition.history, { at: now(), revision: definition.revision + 1, event: "Source revision changed", note: "Discover or configuration source changed after review; a new definition review is required." }] } }));
    onNotice("A new definition revision is ready. Recheck the Discover commercial source before requesting review.");
  }

  const field = (label: string, key: keyof DefinitionRecord, hint: string, rows = 3) => {
    const registerKey: Partial<Record<keyof DefinitionRecord, string>> = { includedScope: "scope_items", acceptance: "acceptance_criteria", milestones: "milestones", dependencies: "dependencies", risks: "risks" };
    if (registerKey[key]) return register(registerKey[key]);
    const componentKey: Partial<Record<keyof DefinitionRecord, string>> = { outcome: "promised_outcome", excludedScope: "excluded_scope", deliveryApproach: "delivery_design" };
    const configured = definePhase?.components.find((item) => item.key === componentKey[key]);
    return <label className={styles.field} key={key}>
      <span>{configured?.label ?? label}<b>REQUIRED</b></span><small>{configured?.help ?? hint}</small>
      <textarea rows={rows} value={String(definition?.[key] ?? "")} disabled={locked} onChange={(event) => saveField(key, event.target.value)} />
    </label>;
  };

  return <main className="d5o-page d5o-record-full d5o-early-phase d5o-define-phase">
    <WorkPhaseJourney active="Define" record={selected} backLabel="Discover" onBack={onBack} onChoose={(phase) => { if (selected) onPhase(selected, phase); }} onControl={(control) => { if (selected) onControl(selected, control); }} />
    <div className={`${styles.metrics} d5o-early-phase-metrics`}>
      <article><small>READY FOR DEFINITION</small><strong>{candidates.length}</strong><span>Qualified or carried-forward work</span></article>
      <article><small>IN ROLE REVIEW</small><strong>{inReview}</strong><span>Definition revisions awaiting decisions</span></article>
      <article><small>DEFINITION APPROVED</small><strong>{ready}</strong><span>Scope baselines ready for the next configured phase</span></article>
    </div>
    <div className={`${styles.layout} d5o-early-phase-layout`}>
      <section className={`${styles.queue} d5o-early-phase-rail`} aria-label="Work ready for definition">
        <header className={styles.sectionHeader}><div><p className={styles.kicker}>WORK TO SHAPE</p><h2>Definition queue</h2></div><span>{candidates.length} Work Record{candidates.length === 1 ? "" : "s"}</span></header>
        {candidates.length ? candidates.map((item) => <button key={item.id} className={`${styles.queueItem} ${selected?.id === item.id ? styles.selected : ""}`} onClick={() => { onSelect(item.id); setSection("scope"); }}><strong>{item.title}</strong><span>{item.customer} · {item.site}</span><small>{item.discovery?.outcome === "Won" ? "Awarded pursuit" : item.discovery?.fit ?? "Qualified"} · {item.definition?.status ?? "Definition not started"}</small></button>) : <div className={styles.empty}><strong>No work is ready for definition</strong><p>Qualify work in Discover to establish the scope and delivery basis here.</p></div>}
      </section>
      {selected && definition ? <section className={`${styles.detail} d5o-early-phase-main`} aria-label="Selected Work Record definition">
        <header className={styles.detailHeader}><div><p className={styles.kicker}>DEFINE · REVISION {definition.revision}</p><h2>Scope and delivery baseline</h2><p>{selected.customer} · {selected.site} · {selected.id.toUpperCase()}</p></div><button className="d5o-outline" onClick={() => onOpen(selected)}>Open Work Record →</button></header>
        <div className={styles.summary}><div><small>STATUS</small><strong>{definition.status}</strong></div><div><small>OWNER</small><strong>{definition.owner}</strong></div><div><small>COMPLETENESS</small><strong>{config ? `${complete} / ${configuredRules.length} configured rules` : "Configuration unavailable"}</strong></div><div><small>DISCOVER BASIS</small><strong>{selected.discovery?.outcome === "Won" ? "Awarded" : selected.discovery?.fit ?? "Unqualified"}</strong></div></div>
        <nav className={styles.tabs} aria-label="Definition sections">{visibleSections.map((item) => <button key={item.key} className={section === item.key ? styles.active : ""} onClick={() => setSection(item.key)}>{item.label}</button>)}</nav>
        <details className="d5o-phase-disclosure"><summary>Configured Define requirements and source</summary>{config && definePhase ? <ConfiguredPhasePanel config={config} phase={definePhase} work={selected} compact /> : <p>No reference configuration matches this Work Type in the selected workspace. Definition review is unavailable.</p>}</details>
        {sourceChanged ? <div className={styles.sourceAlert} role="alert"><strong>Review source changed</strong><span>The reviewed estimate, proposal, or configuration no longer matches this Work Record. The previous decision remains in history; start a new revision before treating the definition as current.</span><button type="button" className="d5o-outline" onClick={refreshSource}>Start new revision</button></div> : null}
        {reviewFocus && definition.status === "In review" ? <div className={styles.sourceAlert}><strong>{reviewFocus === "commercial" ? "Commercial" : "Delivery"} review · revision {definition.revision}</strong><span>Review this exact definition revision and record the decision basis in Risks &amp; handoff. Current role state: {definition.reviews?.[reviewFocus] ?? "Unavailable"}.</span></div> : null}
        {definition.status === "In review" && !reviewFocus ? <button type="button" className="d5o-outline" onClick={onReviewQueued}>Open Commercial and Delivery queues in My work →</button> : null}
        <div className={styles.content}>
          {section === "scope" ? <><div className={styles.intro}><p className={styles.kicker}>CUSTOMER PROMISE</p><h3>Define the result and the boundary</h3><p>Make the outcome and acceptance test explicit before designing delivery.</p></div><div className={styles.carry}><strong>Carried forward from Discover</strong><p>{selected.discovery?.need || "No customer need recorded."}</p><small>Source: {selected.discovery?.source ?? "Not recorded"} · Proposal: {selected.discovery?.proposal.status ?? "Not started"}</small></div>{field("Outcome to deliver", "outcome", "The customer result this work must produce.")}{field("Acceptance criteria", "acceptance", "Who accepts what, using which test or evidence?")}{field("Included scope", "includedScope", "Products, services, sites and work packages inside the commitment.")}{field("Excluded scope", "excludedScope", "Explicit boundaries and customer responsibilities.", 2)}</> : null}
          {section === "delivery" ? <><div className={styles.intro}><p className={styles.kicker}>DELIVERY DESIGN</p><h3>Explain how the work will be done</h3><p>Connect execution, timing and dependencies to the promised outcome.</p></div>{field("Delivery approach", "deliveryApproach", "Method, work packages, teams and verification approach.")}{field("Milestones", "milestones", "The major dates or decision checkpoints.", 2)}{field("Dependencies", "dependencies", "Customer access, resources, inputs and external constraints.", 2)}</> : null}
          {section === "commercial" ? <><div className={styles.intro}><p className={styles.kicker}>PINNED COMMERCIAL DEPENDENCY</p><h3>Review the governing rule</h3><p>The current pinned phase configuration requires approved pricing before Define review. Pricing and offers are worked in Develop; this older rule has not been silently changed.</p></div><div className={styles.carry}><strong>Commercial status on this Work Record</strong><div className={styles.carryFacts}><span>Estimate revision <b>{selected.discovery?.estimate.revision ?? 0}</b></span><span>Price <b>{selected.discovery?.estimate.sellPrice ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(selected.discovery.estimate.sellPrice) : "Unpriced"}</b></span><span>Pricing <b>{selected.discovery?.estimate.status ?? "Not started"}</b></span><span>Proposal revision <b>{selected.discovery?.proposal.package?.revision ?? "Not prepared"}</b></span><span>Proposal <b>{selected.discovery?.proposal.status ?? "Not started"}</b></span></div><small>{selected.discovery?.estimate.status === "Approved" ? "This pinned rule is satisfied by the approved estimate revision." : "This pinned configuration still blocks Define review until the estimate revision is approved. A new published configuration is needed to remove the backward dependency for future work."}</small><button type="button" className="d5o-outline" onClick={() => onPhase(selected, "Develop")}>Open commercial work in Develop →</button></div><div className={styles.carry}><strong>Recorded offer terms</strong><p>{selected.discovery?.proposal.package?.commercialTerms || "No proposal terms have been recorded."}</p><small>Offer terms are displayed from their saved revision; editing them here would create a conflicting source.</small></div></> : null}
          {section === "risks" ? <><div className={styles.intro}><p className={styles.kicker}>CONTROL & HANDOFF</p><h3>Expose the conditions before the next phase</h3><p>Capture the delivery risks and record each review against an exact revision.</p></div>{field("Risks and mitigations", "risks", "What could prevent the result, and who will control it?")}<div className={styles.review}><div><p className={styles.kicker}>DEFINITION REVIEW</p><h3>{definition.status === "Approved" ? "Definition baseline approved" : definition.status === "In review" ? "Role decisions required" : "Prepare for role review"}</h3><p>Approval confirms the scope and delivery basis. Offer, award and delivery decisions remain separate.</p></div>{!config ? <div className={styles.missing}><strong>Compatible configuration unavailable</strong><p>Review cannot proceed for this Work Type.</p></div> : missing.length ? <div className={styles.missing}><strong>{missing.length} configured requirements remain</strong><ul>{missing.map((item) => <li key={item.key}>{item.message}</li>)}</ul></div> : <p className={styles.ready}>Configured review requirements are complete.</p>}{sourceChanged ? <div className={styles.missing}><strong>Commercial source changed during review</strong><p>This review refers to an earlier Discover revision. Start a new definition revision to use the current source.</p><button className="d5o-outline" onClick={refreshSource}>Start new revision</button></div> : null}{definition.status === "Draft" ? <button className="d5o-primary" disabled={!config || missing.length > 0} onClick={submit}>Request Commercial and Delivery review</button> : null}{definition.status === "Changes requested" ? <p className={styles.hint}>Edit a field to start revision {definition.revision + 1}, then resubmit it.</p> : null}{definition.status === "In review" && definition.reviews ? <div className={styles.roles}>{(["commercial", "delivery"] as const).map((role) => <div key={role}><strong>{role === "commercial" ? "Commercial role queue" : "Delivery role queue"}</strong><span>{definition.reviews?.[role]}</span>{definition.reviews?.[role] === "Pending" ? <div className={styles.roleActions}><button className="d5o-outline" disabled={!reviewNote.trim() || sourceChanged || missing.length > 0 || !config} onClick={() => decide(role, "Changes requested")}>Request changes</button><button className="d5o-primary" disabled={!reviewNote.trim() || sourceChanged || missing.length > 0 || !config} onClick={() => decide(role, "Approved")}>Approve revision {definition.revision}</button></div> : null}</div>)}<label className={styles.field}><span>Decision basis</span><textarea rows={2} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Reason, condition or requested change" /></label><small>Synthetic role queues for prototype review. Live user authority is not enforced here.</small></div> : null}{definition.status === "Approved" ? <p className={styles.ready}>Commercial and Delivery reviews are recorded. Next: {commercialRequired ? "authorization and readiness review" : "Develop solution, estimate and offer"} on this Work Record.</p> : null}</div></> : null}
        </div>
        <details className={styles.history}><summary>Definition revision history · {definition.history.length} events</summary>{definition.history.length ? <ol>{definition.history.slice().reverse().map((item, index) => <li key={`${item.at}-${index}`}><strong>Revision {item.revision} · {item.event}</strong><span>{item.note}</span><small>{new Date(item.at).toLocaleString()}</small></li>)}</ol> : <p>No review events yet.</p>}</details>
      </section> : <section className={styles.emptyDetail}><h2>Select work to define</h2><p>Qualified pursuits appear here on the same Work Record.</p></section>}
    </div>
  </main>;
}
