"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useMemo, useState } from "react";
import { focusTarget } from "@/components/d5o/focus-target";
import { WorkflowCompletionPanel } from "@/components/d5o/workflow-completion/WorkflowCompletionPanel";
import type { EndUserAction } from "@/lib/d5o/end-user/derive-primary-action";
import type { EndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import {
  getBillingBackupCompletionContext,
  getBillingBackupProofFocusId,
  getCloseoutCompletionContext,
  getCloseoutProofFocusId,
  getFieldIssueCompletionContext,
  getFieldIssueProofFocusId
} from "@/lib/d5o/workflow-completion/completion-service";

type FocusedTaskPanelProps = {
  summary: EndUserWorkspaceSummary;
};

function getUrlFocus() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("focus");
}

function getPilotModeFlag() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("pilot") === "1";
}

function findFocusedAction(summary: EndUserWorkspaceSummary, focusId: string | null): EndUserAction {
  const actions = [summary.primaryAction, ...summary.secondaryActions];
  return actions.find((action) => action.taskOutcome.focusId === focusId) ?? summary.primaryAction;
}

export function FocusedTaskPanel({ summary }: FocusedTaskPanelProps) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [cameFromPilot, setCameFromPilot] = useState(false);
  const action = useMemo(() => findFocusedAction(summary, focusId), [focusId, summary]);
  const billingCompletionContext = useMemo(() => getBillingBackupCompletionContext(), []);
  const fieldIssueCompletionContext = useMemo(() => getFieldIssueCompletionContext(), []);
  const closeoutCompletionContext = useMemo(() => getCloseoutCompletionContext(), []);
  const shouldShowBillingCompletion = action.taskOutcome.workflowCompletionId === getBillingBackupProofFocusId() &&
    Boolean(billingCompletionContext);
  const shouldShowFieldIssueCompletion = action.taskOutcome.workflowCompletionId === getFieldIssueProofFocusId() &&
    Boolean(fieldIssueCompletionContext);
  const shouldShowCloseoutCompletion = action.taskOutcome.workflowCompletionId === getCloseoutProofFocusId() &&
    Boolean(closeoutCompletionContext);
  const shouldShowPilotReturn = cameFromPilot || shouldShowBillingCompletion || shouldShowFieldIssueCompletion || shouldShowCloseoutCompletion;
  const blocker = summary.criticalBlockers[0]?.title ?? summary.statusReason;
  const evidenceItems = shouldShowBillingCompletion && billingCompletionContext
    ? billingCompletionContext.evidenceRequirements.slice(0, 3).map((requirement) => ({ title: requirement.title }))
    : shouldShowFieldIssueCompletion && fieldIssueCompletionContext.item.sourceIssue?.relatedEvidence
      ? fieldIssueCompletionContext.item.sourceIssue.relatedEvidence.slice(0, 3).map((title) => ({ title }))
      : shouldShowCloseoutCompletion && closeoutCompletionContext
        ? closeoutCompletionContext.item.requiredEvidenceIds.slice(0, 3).map((id) => ({
            title: id === "closeout-asbuilt-redline-package"
              ? "As-built redline package"
              : id === "closeout-completion-verification"
                ? "Test results or completion verification"
                : "Client acceptance support"
          }))
    : summary.evidenceNeededNow.slice(0, 3);

  useEffect(() => {
    const updateFromUrl = () => {
      setFocusId(getUrlFocus());
      setCameFromPilot(getPilotModeFlag());
    };
    const updateFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ focusId?: string }>).detail;
      setFocusId(detail?.focusId ?? getUrlFocus());
      setCameFromPilot(getPilotModeFlag());
    };

    updateFromUrl();
    window.addEventListener("popstate", updateFromUrl);
    window.addEventListener("hashchange", updateFromUrl);
    window.addEventListener("rybexos:task-focus", updateFromEvent);

    return () => {
      window.removeEventListener("popstate", updateFromUrl);
      window.removeEventListener("hashchange", updateFromUrl);
      window.removeEventListener("rybexos:task-focus", updateFromEvent);
    };
  }, []);

  useEffect(() => {
    if (!focusId && window.location.hash !== "#focused-task") return;
    window.requestAnimationFrame(() => focusTarget("focused-task"));
  }, [focusId]);

  return (
    <article
      className="focused-task-panel"
      data-qa="focused-task-panel"
      id="focused-task"
      tabIndex={-1}
    >
      <div className="focused-task-header">
        <div>
          <p className="eyebrow">You are here to</p>
          <h2>{action.taskOutcome.targetObjectTitle}</h2>
          <p>{action.taskOutcome.reason}</p>
        </div>
        <div className="completion-related-links">
          {shouldShowPilotReturn ? (
            <a className="quiet-link" data-qa="return-to-pilot-mode" href="/pilot?refresh=completion">
              Return to workflow list
            </a>
          ) : null}
          <span className={`chip chip-${action.severity === "critical" ? "critical" : action.severity === "high" ? "warning" : "info"}`}>
            {action.severity}
          </span>
        </div>
      </div>

      <dl className="focused-task-grid">
        <div>
          <dt>Source</dt>
          <dd>{action.taskOutcome.targetSection}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{action.owner}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{action.dueDate}</dd>
        </div>
        <div>
          <dt>Blocked by</dt>
          <dd>{blocker}</dd>
        </div>
      </dl>

      <div className="focused-task-next">
        <span>Do next</span>
        <strong>{action.taskOutcome.nextStepInstruction}</strong>
      </div>

      <div className="focused-task-evidence">
        <span>Evidence needed</span>
        <strong>
          {evidenceItems.length > 0
            ? evidenceItems.map((item) => item.title).join(" · ")
            : "None blocking"}
        </strong>
      </div>

      <div className="focused-task-actions">
        <a className="button button-primary" href="#details-records" onClick={() => focusTarget("details-records")}>
          Open exact details
        </a>
      </div>

      {shouldShowBillingCompletion && billingCompletionContext ? (
        <WorkflowCompletionPanel context={billingCompletionContext} />
      ) : null}
      {shouldShowFieldIssueCompletion && fieldIssueCompletionContext ? (
        <WorkflowCompletionPanel context={fieldIssueCompletionContext} />
      ) : null}
      {shouldShowCloseoutCompletion && closeoutCompletionContext ? (
        <WorkflowCompletionPanel context={closeoutCompletionContext} />
      ) : null}
    </article>
  );
}
