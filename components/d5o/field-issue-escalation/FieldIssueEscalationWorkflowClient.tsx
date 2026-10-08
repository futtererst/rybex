"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addFieldIssueEvidenceReferenceAction,
  createChangeEventFromFieldIssueAction,
  createRfiFromFieldIssueAction,
  resolveFieldIssueEscalationAction,
  saveFieldIssueAssessmentAction,
  selectFieldIssueEscalationPathAction,
  startFieldIssueEscalationAction
} from "@/app/actions/field-issue-escalation";
import type { FieldIssueActionState } from "@/lib/d5o/field-issue-escalation/store";
import type { FieldIssueEscalationPath, FieldIssueEscalationState } from "@/lib/d5o/field-issue-escalation/types";

type FieldIssueEscalationWorkflowClientProps = {
  initialState: FieldIssueActionState;
};

type FieldIssueStepId =
  | "understand"
  | "assess"
  | "evidence"
  | "path"
  | "downstream"
  | "resolve"
  | "outcome";

export function FieldIssueEscalationWorkflowClient({
  initialState
}: FieldIssueEscalationWorkflowClientProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState("");
  const [assessment, setAssessment] = useState({
    impactSummary: state.issue.assessment?.impactSummary ?? "Hospital access road bore crew is held because utility locates and traffic-control release are unresolved.",
    scheduleDays: state.issue.assessment?.scheduleDays ?? 2,
    costExposure: state.issue.assessment?.costExposure ?? state.issue.costExposure,
    scheduleImpact: state.issue.assessment?.scheduleImpact ?? true,
    safetyImpact: state.issue.assessment?.safetyImpact ?? true,
    qualityImpact: state.issue.assessment?.qualityImpact ?? false
  });
  const [evidenceText, setEvidenceText] = useState(state.issue.evidenceReferences[0]?.referenceText ?? "DR dr-lake-bore-0610, locate sketch, and GC standby note");
  const [selectedPath, setSelectedPath] = useState<FieldIssueEscalationPath>(state.issue.selectedEscalationPath ?? "rfi");
  const [resolutionNote, setResolutionNote] = useState(state.issue.resolutionNote ?? "Downstream RFI created from field issue; original blocker cleared for follow-up.");
  const [isPending, startTransition] = useTransition();
  const activeStep = useMemo(() => getFieldIssueStep(state.issue.state), [state.issue.state]);
  const nextStep = useMemo(() => deriveNextStep(state), [state]);
  const evidenceComplete = state.issue.evidenceReferences.length;
  const downstreamRecord = state.issue.downstreamRecords[0];
  const resolved = state.issue.state === "resolved";

  const run = (command: () => Promise<FieldIssueActionState & { success: boolean; message: string; error?: string }>) => {
    startTransition(async () => {
      const result = await command();
      setState({
        issue: result.issue,
        readiness: result.readiness,
        impact: result.impact,
        storageLabel: result.storageLabel
      });
      setMessage(result.message || result.error || "Field issue action complete.");
      router.refresh();
    });
  };

  return (
    <section className={`guided-work-surface field-workbench field-workbench-step-${activeStep}${resolved ? " field-workbench-resolved" : ""}`} data-qa="field-issue-escalation-workflow" id="field-issue-escalation">
      <div className="field-workflow-header" data-qa="field-issue-situation-header">
        <div>
          <p className="eyebrow">Active field escalation</p>
          <h2>{resolved ? "Field issue resolved" : "Resolve the Lake Norman field issue"}</h2>
          <p>
            {resolved
              ? "The original field blocker is cleared and the downstream record is ready for follow-up."
              : "Utility locates and traffic-control release are not confirmed for the hospital access road bore path. Create the right RFI or change path and clear the field blocker."}
          </p>
        </div>
        <span className={`chip ${resolved ? "chip-success" : "chip-critical"}`} data-qa="field-issue-state">
          {state.issue.state.replaceAll("_", " ")}
        </span>
      </div>

      <ol className="guided-step-summary" data-qa="field-issue-step-progress">
        {getFieldIssueProgress(activeStep, state.issue.state).map((step) => (
          <li className={`guided-step guided-step-${step.state}`} key={step.id}>
            <span>{step.state}</span>
            <strong>{step.label}</strong>
          </li>
        ))}
      </ol>

      <div className="field-workflow-brief">
        <strong>{resolved ? "What changed" : "Required now"}</strong>
        <span data-qa="field-issue-readiness">{resolved ? "Original field issue resolved and downstream record created." : nextStep}</span>
      </div>

      <div className="guided-work-body field-guided-layout">
      <section className="guided-current-step field-current-step-card panel" data-qa="field-issue-current-step">
        {activeStep === "understand" ? (
          <div data-qa="field-issue-step-understand">
            <StepHeading eyebrow="Start escalation" title="Start the escalation" text="Confirm that this condition needs formal follow-up. The workflow will guide the user to an RFI, Change Event, or both." />
            <p className="field-mobile-issue-line">{state.issue.summary}</p>
            <dl className="completion-facts">
              <div><dt>Issue</dt><dd>{state.issue.summary}</dd></div>
              <div><dt>Location</dt><dd>{state.issue.location}</dd></div>
              <div><dt>Owner</dt><dd>{state.issue.owner}</dd></div>
              <div><dt>Reported by</dt><dd>{state.issue.reportedBy}</dd></div>
            </dl>
            {state.issue.state !== "unresolved" ? <p className="ready-callout">Escalation has already been started.</p> : null}
            <button
              className="button button-primary"
              data-qa="field-issue-start"
              disabled={isPending || state.issue.state !== "unresolved"}
              onClick={() => run(() => startFieldIssueEscalationAction({ issueId: state.issue.id }))}
              type="button"
            >
              Start escalation
            </button>
          </div>
        ) : null}

        {activeStep === "assess" ? (
          <div data-qa="field-issue-step-assess">
            <StepHeading eyebrow="Assess impact" title="Explain the field impact" text="Capture the minimum impact needed to choose an RFI or change path." />
            <label className="form-field-wide">
              <span>Impact summary</span>
              <textarea data-qa="field-issue-assessment-input" onChange={(event) => setAssessment((current) => ({ ...current, impactSummary: event.target.value }))} rows={3} value={assessment.impactSummary} />
            </label>
            <div className="form-grid">
              <label>
                <span>Days exposed</span>
                <input data-qa="field-issue-schedule-input" min={0} onChange={(event) => setAssessment((current) => ({ ...current, scheduleDays: Number(event.target.value) }))} type="number" value={assessment.scheduleDays} />
              </label>
              <label>
                <span>Cost exposure</span>
                <input data-qa="field-issue-cost-input" min={0} onChange={(event) => setAssessment((current) => ({ ...current, costExposure: Number(event.target.value) }))} type="number" value={assessment.costExposure} />
              </label>
            </div>
            <button
              className="button button-primary"
              data-qa="field-issue-save-assessment"
              disabled={isPending || state.issue.state !== "in_progress"}
              onClick={() => run(() => saveFieldIssueAssessmentAction({
                issueId: state.issue.id,
                issueType: "utility_conflict",
                impactSummary: assessment.impactSummary,
                scheduleImpact: assessment.scheduleImpact,
                scheduleDays: assessment.scheduleDays,
                costExposure: assessment.costExposure,
                safetyImpact: assessment.safetyImpact,
                qualityImpact: assessment.qualityImpact
              }))}
              type="button"
            >
              Save assessment
            </button>
          </div>
        ) : null}

        {activeStep === "evidence" ? (
          <div data-qa="field-issue-step-evidence">
            <StepHeading eyebrow="Add evidence" title="Point to the field proof" text="Add the daily report, sketch, field note, or external reference that supports the escalation." />
            <label className="form-field-wide">
              <span>Evidence reference</span>
              <input data-qa="field-issue-evidence-input" onChange={(event) => setEvidenceText(event.target.value)} value={evidenceText} />
            </label>
            {!state.readiness.assessmentComplete ? <p className="missing-callout">Save the impact assessment before adding evidence.</p> : null}
            <button
              className="button button-primary"
              data-qa="field-issue-add-evidence"
              disabled={isPending || !state.readiness.assessmentComplete || state.issue.state === "resolved"}
              onClick={() => run(() => addFieldIssueEvidenceReferenceAction({
                issueId: state.issue.id,
                requirementId: state.issue.evidenceRequirements[0]?.id ?? "field-daily-report-reference",
                referenceText: evidenceText,
                referenceType: "daily_report"
              }))}
              type="button"
            >
              Add evidence
            </button>
          </div>
        ) : null}

        {activeStep === "path" ? (
          <div data-qa="field-issue-step-path">
            <StepHeading eyebrow="Choose path" title="Decide what formal action is needed" text="Choose an RFI when the team needs direction; choose a change event when the issue needs commercial recovery." />
            <label>
              <span>Escalation path</span>
              <select data-qa="field-issue-path-select" onChange={(event) => setSelectedPath(event.target.value as FieldIssueEscalationPath)} value={selectedPath}>
                <option value="rfi">RFI</option>
                <option value="change_event">Change Event</option>
              </select>
            </label>
            {!state.readiness.evidenceComplete ? <p className="missing-callout">Add evidence before choosing the escalation path.</p> : null}
            <button
              className="button button-primary"
              data-qa="field-issue-select-path"
              disabled={isPending || !state.readiness.evidenceComplete || state.issue.state === "resolved"}
              onClick={() => run(() => selectFieldIssueEscalationPathAction({ issueId: state.issue.id, path: selectedPath }))}
              type="button"
            >
              Select path
            </button>
          </div>
        ) : null}

        {activeStep === "downstream" ? (
          <div data-qa="field-issue-step-downstream">
            <StepHeading eyebrow="Create downstream action" title={selectedPath === "rfi" ? "Create the RFI" : "Create the change event"} text="The original field issue should not be cleared until the downstream record exists." />
            {!state.readiness.escalationPathSelected ? <p className="missing-callout">Select the escalation path before creating the downstream action.</p> : null}
            <button
              className="button button-primary"
              data-qa="field-issue-create-downstream"
              disabled={isPending || !state.readiness.escalationPathSelected || state.issue.state === "resolved"}
              onClick={() => run(() => selectedPath === "rfi"
                ? createRfiFromFieldIssueAction({ issueId: state.issue.id })
                : createChangeEventFromFieldIssueAction({ issueId: state.issue.id }))}
              type="button"
            >
              Create downstream action
            </button>
          </div>
        ) : null}

        {activeStep === "resolve" ? (
          <div data-qa="field-issue-step-resolve">
            <StepHeading eyebrow="Resolve escalation" title="Clear the original field blocker" text="Clear the field blocker only after the downstream RFI or change event exists." />
            <label className="form-field-wide">
              <span>Resolution note</span>
              <textarea data-qa="field-issue-resolution-note" onChange={(event) => setResolutionNote(event.target.value)} rows={3} value={resolutionNote} />
            </label>
            {!state.readiness.resolutionReady ? <p className="missing-callout">Create the RFI or change event before resolving this field issue.</p> : null}
            <button
              className="button button-primary"
              data-qa="field-issue-resolve"
              disabled={isPending || !state.readiness.resolutionReady || state.issue.state === "resolved"}
              onClick={() => run(() => resolveFieldIssueEscalationAction({ issueId: state.issue.id, resolutionNote }))}
              type="button"
            >
              Clear field blocker
            </button>
          </div>
        ) : null}

        {activeStep === "outcome" ? (
          <section data-qa="field-issue-outcome">
            <StepHeading eyebrow="Resolved outcome" title="Field issue escalated and cleared" text="The original field blocker is resolved and the downstream record is available for follow-up." />
            {state.issue.outcomeRecord ? (
              <div className="field-outcome-record">
                <strong>{downstreamRecord?.recordNumber ?? state.issue.outcomeRecord.downstreamRecordIds.join(", ")} created</strong>
                <span>Original field issue resolved. Command Center updated.</span>
                {downstreamRecord ? (
                  <Link className="button button-secondary" href={downstreamRecord.route}>
                    View in {downstreamRecord.route === "/rfis-submittals" ? "RFIs/Submittals" : "Changes"}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </section>

      <aside className="workbench-support-panel field-workflow-support" aria-label="Field issue workflow support">
        <section>
          <span>Required now</span>
          <strong>{nextStep}</strong>
        </section>
        <section>
          <span>Complete</span>
          <strong>{deriveFieldIssueCompleteText(evidenceComplete, state.issue.downstreamRecords.length)}</strong>
        </section>
        <section>
          <span>Next</span>
          <strong>{deriveFieldIssueOutcomeText(state.issue.state, downstreamRecord?.recordNumber)}</strong>
        </section>
      </aside>
      </div>

      {message ? <p className={state.issue.state === "resolved" ? "ready-callout" : "missing-callout"} data-qa="field-issue-message">{message}</p> : null}

      <details className="guided-supporting-details">
        <summary>Supporting field issue details</summary>
        <dl className="completion-facts">
          <div><dt>Work package</dt><dd>{state.issue.workPackageName}</dd></div>
          <div><dt>Evidence</dt><dd>{state.issue.evidenceReferences.length} reference(s)</dd></div>
          <div><dt>Path</dt><dd>{state.issue.selectedEscalationPath?.replaceAll("_", " ") ?? "Not selected"}</dd></div>
          <div><dt>History</dt><dd>{state.issue.history.length} event(s)</dd></div>
        </dl>
      </details>
    </section>
  );
}

function StepHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function getFieldIssueStep(state: FieldIssueEscalationState): FieldIssueStepId {
  if (state === "resolved") return "outcome";
  if (state === "downstream_created") return "resolve";
  if (state === "path_selected") return "downstream";
  if (state === "evidence_added") return "path";
  if (state === "assessed") return "evidence";
  if (state === "in_progress") return "assess";
  return "understand";
}

function getFieldIssueProgress(activeStep: FieldIssueStepId, state: FieldIssueEscalationState) {
  const steps: Array<{ id: FieldIssueStepId; label: string }> = [
    { id: "understand", label: "Understand" },
    { id: "assess", label: "Assess" },
    { id: "evidence", label: "Evidence" },
    { id: "path", label: "Escalate" },
    { id: "downstream", label: "Create record" },
    { id: "resolve", label: "Resolve" },
    { id: "outcome", label: "Resolved" }
  ];
  const activeIndex = steps.findIndex((step) => step.id === activeStep);
  return steps.map((step, index) => ({
    ...step,
    state: state === "resolved" || index < activeIndex
      ? "done"
      : index === activeIndex
        ? "current"
        : "locked"
  }));
}

function deriveNextStep(state: FieldIssueActionState) {
  if (state.issue.state === "resolved") return "Resolved and recorded.";
  if (!state.readiness.assessmentComplete) return "Save the impact assessment.";
  if (!state.readiness.evidenceComplete) return "Add an evidence reference.";
  if (!state.readiness.escalationPathSelected) return "Select RFI or Change Event.";
  if (!state.readiness.downstreamRecordCreated) return "Create the downstream action.";
  return "Ready to clear the original field blocker.";
}

function deriveFieldIssueOutcomeText(state: FieldIssueEscalationState, downstreamRecordNumber?: string) {
  if (state === "resolved") return downstreamRecordNumber ? `${downstreamRecordNumber} is ready for follow-up.` : "Track the downstream record.";
  if (state === "downstream_created") return "Clear the original field issue.";
  if (state === "path_selected") return "Create the RFI or change event.";
  if (state === "evidence_added") return "Choose the formal escalation path.";
  if (state === "assessed") return "Add evidence before choosing the path.";
  if (state === "in_progress") return "Save the impact assessment.";
  return "Start the escalation.";
}

function deriveFieldIssueCompleteText(evidenceCount: number, downstreamRecordCount: number) {
  if (evidenceCount === 0 && downstreamRecordCount === 0) return "No evidence or downstream record yet.";
  if (downstreamRecordCount > 0) return `${evidenceCount} evidence reference${evidenceCount === 1 ? "" : "s"} and downstream record created.`;
  return `${evidenceCount} evidence reference${evidenceCount === 1 ? "" : "s"} added.`;
}
