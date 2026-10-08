import { randomUUID } from "node:crypto";
import Link from "next/link";
import { performWorkExtension, performWorkspaceDecision } from "@/app/work/[workspace]/[work]/actions";
import type { WorkExtensions } from "@/lib/d5o/work-record/server";
import type { JsonObject, WorkRecordView } from "@/lib/d5o/work-record/types";
import { blockerLabel, object, outcomeLabel, readable, requiredProof, rows, text } from "./proof-presentation";
import { ProofDecisionPanel } from "./ProofDecisionPanel";

const card = { padding: 24, background: "white", border: "1px solid #dbe3eb", borderRadius: 12 };

function displayWorkTitle(title: string) {
  return title.replace(/^Synthetic\s+(Synthetic\s+)?/i, "");
}

function ActionFields({ view, kind, returnTo = "take-action" }: { view: WorkRecordView; kind: "new_proof" | "submit_proof" | "decide"; returnTo?: "prepare-proof" | "take-action" }) {
  return <>
    <input type="hidden" name="workspaceId" value={view.work.workspace_id} />
    <input type="hidden" name="workId" value={view.work.id} />
    <input type="hidden" name="recordVersion" value={view.work.record_version} />
    <input type="hidden" name="proofRevision" value={view.proof?.proof_package_revision ?? ""} />
    <input type="hidden" name="commandId" value={randomUUID()} />
    <input type="hidden" name="kind" value={kind} />
    <input type="hidden" name="returnTo" value={returnTo} />
  </>;
}

function ExtensionFields({ view, extensions, kind }: { view: WorkRecordView; extensions: WorkExtensions; kind: "create_package" | "record_package_facts" | "plan_lifecycle_action" }) {
  return <>
    <input type="hidden" name="workspaceId" value={view.work.workspace_id} />
    <input type="hidden" name="workId" value={view.work.id} />
    <input type="hidden" name="recordVersion" value={extensions.recordVersion} />
    <input type="hidden" name="commandId" value={randomUUID()} />
    <input type="hidden" name="kind" value={kind} />
  </>;
}

function actionResultMessage(result: string | undefined) {
  if (!result) return null;
  const messages: Record<string, string> = {
    recorded: "The configured decision was recorded. The outcome and history below are current.",
    concurrency_conflict: "This Work Record changed. Review the latest state before acting again.",
    readiness_blocked: "The decision remains blocked by configured readiness requirements.",
    wrong_authority: "Your current role is not authorized for this decision.",
    separation_of_duty: "This decision requires a different role under the configured separation-of-duty rule.",
    proof_revision_stale: "The proof package changed. Review the current revision before acting again.",
    invalid_proof_revision: "The selected proof revision is not valid for this decision.",
    pinned_configuration_changed: "The pinned configuration is no longer available for governed action.",
    configuration_unavailable: "The pinned configuration is unavailable. No action was recorded.",
    forbidden: "This Work Record is outside your authorized workspace scope.",
    command_failed: "The action was not recorded. Review the current state and try again if appropriate.",
    invalid_package_facts: "Installed and tested quantities must be valid, cumulative and within the package scope. No change was saved.",
    package_unavailable: "This Work Package is unavailable in the selected Work Record.",
    idempotency_mismatch: "The submitted action no longer matches its original request. Refresh before retrying.",
    work_closed: "Reopen the governed work before creating a package or changing its facts.",
    proof_revision_required: "The submitted proof is frozen. Start a new proof revision before changing a Work Package."
  };
  return messages[result] ?? "The action was not recorded. Review the current state.";
}

export function WorkRecordWorkspace({ view, extensions, workspaceName, result }: { view: WorkRecordView; extensions: WorkExtensions; workspaceName: string; result?: string }) {
  const config = view.work.configuration_snapshot;
  const gate = object(config.gate);
  const workType = object(config.workType);
  const roles = rows(config.roles);
  const rights = rows(config.rights);
  const proof = requiredProof(config);
  const complete = view.work.lifecycle_state === object(object(config.workType).lifecycle_json).completeState;
  const configuredActionCount = view.actions.length;
  const hasActionReadyNow = view.actions.some((action) => action.blockers.length === 0);
  const readinessState = complete ? "Complete" : hasActionReadyNow ? "Ready for your decision" : view.blockers.length > 0 ? "Needs attention" : "Ready for governed action";
  const proofState = view.proof ? readable(view.proof.status) : "Not started";
  const canEditPackages = view.ownerCanPrepare && !complete && !["submitted", "held"].includes(view.proof?.status ?? "");
  const nextStep = complete
    ? { title: "Review the completed outcome", detail: "This configured gate is complete. Use the handoff record and history to understand what was recorded and why.", href: "#handoff", label: "Review handoff" }
    : view.actions.length > 0
      ? { title: "Review and record the next decision", detail: view.actions.some((action) => action.blockers.length === 0) ? "A configured decision is available to your current role. Review its consequence before recording it." : "A configured decision is assigned to your role, but one or more configured requirements still block it.", href: "#take-action", label: "Review decision" }
      : view.ownerCanPrepare && !view.proof
        ? { title: "Prepare the proof package", detail: "Start a proof revision once the configured facts and evidence are ready for review.", href: "#prepare-proof", label: "Prepare proof" }
        : view.ownerCanPrepare && view.proof?.status === "draft"
          ? { title: "Submit the proof package", detail: "Submission checks the configured readiness and evidence requirements before the work can move to review.", href: "#prepare-proof", label: "Review proof" }
          : view.proof?.status === "submitted"
            ? { title: "Wait for the configured reviewer", detail: "The proof is submitted. A different configured role owns the next decision.", href: "#authority", label: "See decision authority" }
            : { title: "Review what blocks progress", detail: "Check readiness, proof and decision authority to see what must happen before this work can advance.", href: "#readiness", label: "Review blockers" };

  return <main className="d5o-record-page">
    <section aria-label="Workspace identity" className="workspace-identity d5o-record-workspace">
      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Workspace</p>
      <p style={{ margin: "0 0 8px", fontSize: 26, lineHeight: 1.25, fontWeight: 750, textTransform: "capitalize" }}>{workspaceName}</p>
      <p style={{ margin: 0 }}>{text(workType.label) || "Governed work"}</p>
      <p style={{ margin: "12px 0 0" }}><Link className="button button-secondary" href="/work">Back to Work</Link></p>
    </section>

    <header className="d5o-record-title">
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Work</p>
      <h1 style={{ margin: 0 }}>{displayWorkTitle(view.work.title)}</h1>
      <p style={{ marginBottom: 0, color: "#536171" }}><strong>Current gate:</strong> {text(gate.label) || readable(view.work.gate_key)} · {text(gate.purpose)}</p>
      <nav aria-label="Work sections" className="d5o-record-tabs">
        {[["take-action", "Action"], ["readiness", "What needs to be true"], ["evidence", "Proof"], ["authority", "People & decisions"], ["history", "History"]].map(([id, label]) => <a key={id} href={`#${id}`} className="button button-secondary">{label}</a>)}
        <details className="d5o-record-more"><summary>More</summary><div>{[["overview", "Overview"], ["lifecycle", "Lifecycle"], ["plan", "Plan"], ["execution", "Execution"], ["issues-changes", "Issues & changes"], ["handoff", "Handoff"], ["lifecycle-value", "Lifecycle value"]].map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</div></details>
      </nav>
    </header>

    <section aria-label="What needs to happen now" className="d5o-record-next" style={{ ...card, borderLeft: "5px solid var(--workspace-accent, #163a5f)", display: "grid", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>What needs to happen now</p>
      <h2 style={{ margin: 0 }}>{nextStep.title}</h2>
      <p style={{ margin: 0 }}>{nextStep.detail}</p>
      <p style={{ margin: 0 }}><strong>You are acting as:</strong> {readable(view.actor.workspace_role)}</p>
      <p style={{ margin: "4px 0 0" }}><a className="button button-primary" href={nextStep.href}>{nextStep.label}</a></p>
    </section>

    <section id="take-action" className="d5o-action-surface" style={card}>
      <div className="d5o-action-surface-head">
        <div><p className="d5o-eyebrow">Make progress</p><h2>Decide what happens next</h2></div>
        <span>{view.proof ? `Proof ${view.proof.proof_package_revision} · ${readable(view.proof.status)}` : "Proof not started"}</span>
      </div>
      {actionResultMessage(result) ? <p className="d5o-action-message" role="status">{actionResultMessage(result)}</p> : null}
      {view.proof?.status !== "submitted" ? <div className="d5o-action-empty"><strong>This work is not ready for a decision yet.</strong><p>A submitted proof package is required before a configured decision can be recorded.</p><a className="button button-secondary" href="#prepare-proof">See the proof package</a></div> : null}
      {view.proof?.status === "submitted" && view.actions.length === 0 ? <div className="d5o-action-empty"><strong>The next action belongs to another person.</strong><p>Your role can see the submitted proof, but has no configured decision at this point in the work.</p><a className="button button-secondary" href="#authority">See who owns it</a></div> : null}
      {view.proof?.status === "submitted" && view.actions.length > 0 ? <ProofDecisionPanel options={view.actions.map(action => {
        const right = rights.find(candidate => candidate.decision_right_key === action.right);
        const role = roles.find(candidate => candidate.id === right?.role_definition_id);
        const rule = object(right?.approval_rule_json);
        const exception = rows(config.exceptions).find(candidate => candidate.exception_rule_key === rule.exceptionRuleKey);
        return {
          id: action.right,
          label: action.label,
          content: <form action={performWorkspaceDecision}>
            <div className="d5o-decision-consequence"><div><span>Work</span><strong>{displayWorkTitle(view.work.title)}</strong></div><div><span>What you are deciding</span><strong>{text(gate.label) || readable(view.work.gate_key)}</strong></div><div><span>What happens after</span><strong>{outcomeLabel(config, right?.outcome_key)}</strong></div></div>
            {action.blockers.length > 0 ? <div className="d5o-decision-blockers"><strong>This option is currently held.</strong><ul>{action.blockers.map((blocker, index) => <li key={index}>{blockerLabel(config, blocker)}</li>)}</ul></div> : <p className="d5o-decision-ready">The visible readiness and proof requirements are met. Your authority and the current Work Record version are checked when you submit.</p>}
            <ActionFields view={view} kind="decide" />
            <input type="hidden" name="rightKey" value={action.right} />
            {exception ? <><input type="hidden" name="scopeKey" value={text(object(exception.waiver_rule_json).scope)} /><label className="d5o-form-field">Exception expiry (UTC)<input type="datetime-local" name="expiresAt" required /></label></> : null}
            <label className="d5o-form-field">Why are you recording this decision?<textarea name="reason" required rows={3} placeholder="State the decision basis for the next person who needs to understand it." /></label>
            <button className="button button-primary" disabled={action.blockers.length > 0}>{action.label}</button>
          </form>
        };
      })} /> : null}
    </section>

    <section aria-label="Work Record pulse" className="d5o-record-pulse" style={card}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Work at a glance</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14 }}>
        {[{ label: "Lifecycle state", value: readable(view.work.lifecycle_state), detail: text(gate.label) || "Configured gate" }, { label: "Readiness", value: readinessState, detail: hasActionReadyNow ? "You can record a decision now" : view.blockers.length ? `${view.blockers.length} condition${view.blockers.length === 1 ? "" : "s"} remain for completion` : "No current blocker reported" }, { label: "Proof package", value: proofState, detail: view.proof ? `Revision ${view.proof.proof_package_revision}` : "Create when ready" }, { label: "Available decisions", value: String(configuredActionCount), detail: configuredActionCount ? "Assigned to the current role" : "No current decision" }].map((item) => <div key={item.label} style={{ border: "1px solid #dbe3eb", borderRadius: 10, padding: 16, display: "grid", gap: 6 }}><span style={{ color: "#536171", fontSize: 13 }}>{item.label}</span><strong>{item.value}</strong><span style={{ fontSize: 13 }}>{item.detail}</span></div>)}
      </div>
    </section>

    <section id="overview" style={card}>
      <h2>Overview</h2>
      <p><strong>Purpose:</strong> {text(gate.purpose)}</p>
      <p><strong>Lifecycle position:</strong> {readable(view.work.lifecycle_state)} · <strong>Current gate:</strong> {text(gate.label)}</p>
      <p><strong>Work Record:</strong> {displayWorkTitle(view.work.title)}</p>
      <details><summary>Governing record details</summary><p>Work type: {view.work.work_type_key}</p><p>Pinned configuration: {view.work.configuration_version_id}</p><p>Record version: {view.work.record_version}</p></details>
    </section>

    <section id="lifecycle" style={card}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Lifecycle</p>
      <h2 style={{ marginBottom: 8 }}>One Work Record through governed progress</h2>
      <p>This record keeps one identity while its configured gate, proof package, decisions and outcomes change over time.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div style={{ border: "1px solid #dbe3eb", borderRadius: 10, padding: 14 }}><strong>Start</strong><p style={{ marginBottom: 0 }}>{readable(object(workType.lifecycle_json).initialState)}</p></div>
        <div style={{ border: "2px solid var(--workspace-accent, #163a5f)", borderRadius: 10, padding: 14 }}><strong>Current position</strong><p style={{ marginBottom: 0 }}>{readable(view.work.lifecycle_state)} · {text(gate.label)}</p></div>
        <div style={{ border: "1px solid #dbe3eb", borderRadius: 10, padding: 14 }}><strong>Configured completion</strong><p style={{ marginBottom: 0 }}>{readable(object(workType.lifecycle_json).completeState)}</p></div>
      </div>
      <p style={{ marginBottom: 0 }}>The lifecycle shown here is read from the Work Record’s pinned configuration. Later configuration changes do not silently change this record’s governing rules.</p>
    </section>

    <section id="plan" style={card}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Plan</p>
      <h2 style={{ marginBottom: 8 }}>What this work is set up to do</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div><strong>Work Type</strong><p>{text(workType.label) || readable(view.work.work_type_key)}</p></div>
        <div><strong>Current gate</strong><p>{text(gate.label) || readable(view.work.gate_key)}</p></div>
        <div><strong>Governing path</strong><p>Locked to this work when it began</p></div>
        <div><strong>Participants</strong><p>{view.participants.length ? `${view.participants.length} participant${view.participants.length === 1 ? "" : "s"} recorded` : "No participant assignments recorded"}</p></div>
      </div>
      {view.participants.length ? <details><summary>Participant details</summary><ul>{view.participants.map((participant, index) => <li key={text(participant.id) || index}>{text(participant.label) || text(participant.role) || "Configured participant"}</li>)}</ul></details> : null}
      <h3>Controlled Work Packages</h3>
      {extensions.packages.length ? <ul>{extensions.packages.map((item) => <li key={item.id}><strong>{item.name}</strong> · {readable(item.status)} · {item.installed_percent}% installed / {item.tested_percent}% tested / {item.accepted_percent}% accepted</li>)}</ul> : <p>No Work Package has been created for this governed record.</p>}
      {canEditPackages ? <form action={performWorkExtension} className="d5o-extension-form"><ExtensionFields view={view} extensions={extensions} kind="create_package" /><input type="hidden" name="packageKey" value={randomUUID()} /><label className="d5o-form-field">Package name<input name="name" maxLength={180} placeholder="For example: Fibre trunks and termination" required /></label><button className="button button-primary">Create Work Package</button></form> : view.ownerCanPrepare && !complete ? <p>Package changes require a new draft proof revision. The submitted package remains frozen for its current decision.</p> : null}
    </section>

    <section id="readiness" style={card}>
      <h2>Readiness and blockers</h2>
      {view.blockers.length > 0 ? <><p>These conditions must be resolved before this gate can be complete. A current decision may still be available where it is the step that resolves a condition.</p><ul>{view.blockers.map((blocker, index) => <li key={index}>{blockerLabel(config, blocker)}</li>)}</ul></> : <p>{complete ? "The configured gate is complete." : "No current readiness blocker is reported. Authority and proof are still checked when a decision is made."}</p>}
      <p><strong>Available to the current role:</strong> {view.actions.length ? view.actions.map(action => action.label).join(" or ") : "No decision is currently assigned to this reviewer."}</p>
    </section>

    <section id="execution" style={card}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Execution</p>
      <h2 style={{ marginBottom: 8 }}>Control the work through its configured gate</h2>
      <p>Execution facts are assessed through the current proof package and configured requirements. This keeps activity, evidence and the governing decision connected to the same Work Record.</p>
      {view.actions.length ? <ul>{view.actions.map((action) => <li key={action.right}><strong>{action.label}</strong> · {action.blockers.length ? `${action.blockers.length} condition${action.blockers.length === 1 ? "" : "s"} still block this action` : "available for configured review"}</li>)}</ul> : <p>No execution decision is currently available to this role. Review readiness and proof to see what must happen next.</p>}
      {extensions.packages.length ? <div className="d5o-extension-packages">{extensions.packages.map((item) => <article key={item.id}><h3>{item.name}</h3><p>{item.installed_percent}% installed · {item.tested_percent}% tested · {item.accepted_percent}% accepted · {readable(item.status)}</p>{canEditPackages && item.status !== "accepted" ? <form action={performWorkExtension} className="d5o-extension-form"><ExtensionFields view={view} extensions={extensions} kind="record_package_facts" /><input type="hidden" name="packageId" value={item.id} /><label className="d5o-form-field">Installed %<input name="installed" type="number" min={item.installed_percent} max={100} step="0.01" defaultValue={item.installed_percent} required /></label><label className="d5o-form-field">Tested %<input name="tested" type="number" min={item.tested_percent} max={100} step="0.01" defaultValue={item.tested_percent} required /></label><button className="button button-secondary">Record work facts</button></form> : null}</article>)}</div> : null}
      <p>Recorded quantities do not imply package acceptance. Acceptance needs its own configured proof and authority decision.</p>
      <a className="button button-secondary" href="#take-action">Go to configured action</a>
    </section>

    <section id="issues-changes" style={card}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Issues &amp; changes</p>
      <h2 style={{ marginBottom: 8 }}>Conditions that need controlled resolution</h2>
      {view.blockers.length ? <ul>{view.blockers.map((blocker, index) => <li key={index}>{blockerLabel(config, blocker)}</li>)}</ul> : <p>No current configured blocker is reported for this gate.</p>}
      <p style={{ marginBottom: 0 }}>A change in readiness, evidence or authority does not advance work by itself. It must be reflected in a new proof revision or a recorded configured decision.</p>
    </section>

    <section id="evidence" style={card}>
      <h2>Evidence and proof</h2>
      <p><strong>Proof package:</strong> {view.proof ? `revision ${view.proof.proof_package_revision} · ${readable(view.proof.status)}` : "not started"}</p>
      {proof.length ? <ul>{proof.map(requirement => <li key={requirement.id}>{requirement.label} · {requirement.level}</li>)}</ul> : <p>This configured gate has no listed evidence requirements.</p>}
      <p>Proof requirements explain what the gate needs. They do not themselves confirm acceptance.</p>
    </section>

    <section id="prepare-proof" style={card}>
      <h2>Prepare proof for review</h2>
      {actionResultMessage(result) ? <p role="status">{actionResultMessage(result)}</p> : null}
      {!view.ownerCanPrepare ? <p>This role can review the current proof but cannot prepare or submit a revision.</p> : null}
      {view.ownerCanPrepare && complete ? <p>This gate is complete. No further proof preparation is available from this workspace.</p> : null}
      {view.ownerCanPrepare && !complete && !view.proof ? <><p>Start a proof revision when the configured facts and required evidence are ready.</p><form action={performWorkspaceDecision}><ActionFields view={view} kind="new_proof" returnTo="prepare-proof" /><button className="button button-secondary">Start proof revision</button></form></> : null}
      {view.ownerCanPrepare && !complete && view.proof?.status === "draft" ? <><p>This is a draft proof revision. Submission evaluates the configured requirements and evidence before the work moves forward.</p><form action={performWorkspaceDecision}><ActionFields view={view} kind="submit_proof" returnTo="prepare-proof" /><button className="button button-primary">Submit proof for review</button></form></> : null}
      {view.ownerCanPrepare && !complete && view.proof?.status === "submitted" ? <><p>The current proof revision is submitted for configured review. Start a new revision only when the package must be updated.</p><form action={performWorkspaceDecision}><ActionFields view={view} kind="new_proof" returnTo="prepare-proof" /><button className="button button-secondary">Start new proof revision</button></form></> : null}
      {view.ownerCanPrepare && !complete && view.proof?.status === "held" ? <p>The proof is held. Correct the configured prerequisites and start a new revision when the package is ready.</p> : null}
    </section>

    <section id="authority" style={card}>
      <h2>Decision authority</h2>
      <p>Roles and consequences are loaded from the Work Record’s pinned configuration.</p>
      <ul>{rights.map(right => {
        const role = roles.find(candidate => candidate.id === right.role_definition_id);
        return <li key={text(right.id)}><strong>{text(right.label)}</strong> · {text(role?.label) || "Configured role"} · consequence: {outcomeLabel(config, right.outcome_key)}</li>;
      })}</ul>
      <p>The action panel below is available only when the current role, submitted proof package and configured requirements permit it.</p>
    </section>

    <section id="decision-context" className="d5o-context-only" style={card}>
      <h2>Decision context</h2>
      {actionResultMessage(result) ? <p role="status">{actionResultMessage(result)}</p> : null}
      {view.proof?.status !== "submitted" ? <p>A submitted proof package is required before a configured decision can be recorded.</p> : null}
      {view.proof?.status === "submitted" && view.actions.length === 0 ? <p>No configured decision is available to the current role. Another role owns the next action.</p> : null}
      {view.proof?.status === "submitted" && view.actions.length > 0 ? <ProofDecisionPanel options={view.actions.map(action => {
        const right = rights.find(candidate => candidate.decision_right_key === action.right);
        const role = roles.find(candidate => candidate.id === right?.role_definition_id);
        const rule = object(right?.approval_rule_json);
        const exception = rows(config.exceptions).find(candidate => candidate.exception_rule_key === rule.exceptionRuleKey);
        return {
          id: action.right,
          label: action.label,
          content: <form action={performWorkspaceDecision}>
            <p><strong>{action.label}</strong> · {text(role?.label) || "Configured decision role"}</p>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, margin: "14px 0" }}>
              <div><dt style={{ color: "#536171", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Work being moved</dt><dd style={{ margin: "4px 0 0", fontWeight: 700 }}>{displayWorkTitle(view.work.title)}</dd></div>
              <div><dt style={{ color: "#536171", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Current gate</dt><dd style={{ margin: "4px 0 0", fontWeight: 700 }}>{text(gate.label) || readable(view.work.gate_key)}</dd></div>
              <div><dt style={{ color: "#536171", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Proof evaluated</dt><dd style={{ margin: "4px 0 0", fontWeight: 700 }}>Revision {view.proof?.proof_package_revision ?? "not started"}</dd></div>
              <div><dt style={{ color: "#536171", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>What happens next</dt><dd style={{ margin: "4px 0 0", fontWeight: 700 }}>{outcomeLabel(config, right?.outcome_key)}</dd></div>
            </dl>
            {action.blockers.length > 0 ? <div role="note"><p>This decision is blocked until these configured requirements are satisfied:</p><ul>{action.blockers.map((blocker, index) => <li key={index}>{blockerLabel(config, blocker)}</li>)}</ul></div> : <p>All currently visible configured requirements are satisfied. Authority and concurrency are checked when you submit.</p>}
            <ActionFields view={view} kind="decide" />
            <input type="hidden" name="rightKey" value={action.right} />
            {exception ? <><input type="hidden" name="scopeKey" value={text(object(exception.waiver_rule_json).scope)} /><label>Exception expiry (UTC)<input type="datetime-local" name="expiresAt" required /></label></> : null}
            <label style={{ display: "grid", gap: 8, marginTop: 12 }}>{action.label}: decision reason<textarea name="reason" required rows={2} style={{ border: "1px solid #aab8c5", padding: 10, borderRadius: 6 }} /></label>
            <button className="button button-primary" disabled={action.blockers.length > 0} style={{ marginTop: 12 }}>{action.label}</button>
          </form>
        };
      })} /> : null}
    </section>

    <section id="handoff" style={card}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Handoff</p>
      <h2 style={{ marginBottom: 8 }}>Verification, acceptance and outcome</h2>
      <p>The handoff record connects the evaluated proof package, the authorized decision and the resulting outcome.</p>
      {view.proof ? <p><strong>Evidence package:</strong> revision {view.proof.proof_package_revision} · {readable(view.proof.status)}</p> : <p><strong>Evidence package:</strong> not started</p>}
      {view.decisions.length ? <ul>{view.decisions.map(decision => <li key={text(decision.id)}><strong>{outcomeLabel(object(decision.configuration_snapshot), decision.outcome_key)}</strong> · {text(object(object(decision.authority_snapshot).role).label) || "Configured authority"} · {text(decision.decided_at)}</li>)}</ul> : <p>No handoff outcome has been recorded.</p>}
      {view.outcomes.length ? <details><summary>Outcome record details</summary><ul>{view.outcomes.map((outcome, index) => { const result = object(outcome.result); const configuredOutcome = object(result.outcome); return <li key={text(outcome.id) || index}>{text(configuredOutcome.label) || text(configuredOutcome.outcome_key) || "Recorded outcome"}{result.valueRealized === false ? " · value realization remains to be measured" : ""}</li>; })}</ul></details> : null}
      <h3>Downstream lifecycle actions</h3>
      {extensions.lifecycleActions.length ? <ul>{extensions.lifecycleActions.map((item) => <li key={item.id}><strong>{item.action}</strong> · {readable(item.status)}{item.due_at ? ` · due ${new Date(item.due_at).toLocaleDateString()}` : ""}</li>)}</ul> : <p>No downstream action has been planned.</p>}
      {view.ownerCanPrepare ? <form action={performWorkExtension} className="d5o-extension-form"><ExtensionFields view={view} extensions={extensions} kind="plan_lifecycle_action" /><label className="d5o-form-field">Lifecycle action<input name="action" maxLength={240} placeholder="For example: 90-day service inspection" required /></label><label className="d5o-form-field">Due date<input name="dueAt" type="date" /></label><button className="button button-secondary">Plan lifecycle action</button></form> : null}
    </section>

    <section id="lifecycle-value" style={card}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Lifecycle value</p>
      <h2 style={{ marginBottom: 8 }}>Value protected through this work</h2>
      <p>Configured commitments make the value being delivered visible alongside the decisions that protect it.</p>
      {view.commitments.length ? <ul>{view.commitments.map(commitment => <li key={text(commitment.id)}><strong>{text(commitment.label)}</strong>: target {text(commitment.target)} {text(commitment.unit)}</li>)}</ul> : <p>No value commitment is configured for this record.</p>}
    </section>

    <section id="history" style={card}>
      <h2>History</h2>
      <ol>{view.history.map(entry => <li key={text(entry.id)}>{text(entry.action).replaceAll("work.", "").replaceAll("_", " ")} · {text(entry.occurred_at)}</li>)}</ol>
      <p>History preserves the original authority, configuration and proof context for recorded decisions.</p>
    </section>
  </main>;
}
