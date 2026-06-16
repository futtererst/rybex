"use client";

import { useMemo, useState } from "react";
import type { CommitWorkflowTransactionResult } from "@/app/actions/workflow-transactions";
import { checkWorkflowTransactionPermission } from "@/lib/d5o/auth/workflow-transaction-permissions";
import { demoUser } from "@/lib/d5o/demo-user";
import { useWorkflowTransactionStore } from "@/lib/d5o/workflow/local-transaction-store";
import {
  getWorkflowTransactionDefinitions,
  type WorkflowTransactionDefinition
} from "@/lib/d5o/workflow/transactions";
import type { OperatingWorkflow } from "@/lib/d5o/workflow/types";
import { WorkflowOutcomeBanner } from "./WorkflowOutcomeBanner";
import { WorkflowTransactionHistory } from "./WorkflowTransactionHistory";
import { WorkflowTransactionModal } from "./WorkflowTransactionModal";

type WorkflowTransactionPanelProps = {
  workflow: OperatingWorkflow;
  compact?: boolean;
};

export function WorkflowTransactionPanel({ workflow, compact = false }: WorkflowTransactionPanelProps) {
  const store = useWorkflowTransactionStore();
  const [selectedDefinition, setSelectedDefinition] = useState<WorkflowTransactionDefinition | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [transactionModeLabel, setTransactionModeLabel] = useState("Local demo transaction");
  const history = store.getTransactionHistoryForWorkflow(workflow.id);
  const latest = history[0];
  const availableDefinitions = useMemo(
    () => getWorkflowTransactionDefinitions(workflow).filter((definition) =>
      definition.type !== "resolve_workflow_action" || workflow.resolutionState !== "resolved"
    ),
    [workflow]
  );
  const hasResolved = workflow.resolutionState === "resolved";
  const allowedDefinitions = availableDefinitions.filter((definition) =>
    checkWorkflowTransactionPermission(demoUser.role, definition.type, workflow.workflowType).allowed
  );
  const unavailableReason = hasResolved
    ? "Workflow is already resolved."
    : availableDefinitions.length === 0
      ? `No transaction mapping is configured for ${workflow.workflowType.replaceAll("_", " ")}.`
      : allowedDefinitions.length === 0
        ? `${demoUser.title} cannot complete these actions in the demo role context.`
        : "";

  async function confirmTransaction(input: {
    notes: string;
    decisionReason: string;
    owner: string;
    evidenceConfirmed: string[];
  }) {
    if (!selectedDefinition) {
      return;
    }

    setIsSubmitting(true);
    setTransactionError("");
    setTransactionMessage("");

    let response: CommitWorkflowTransactionResult;

    try {
      const transactionResponse = await fetch("/api/workflow-transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input,
          transactionType: selectedDefinition.type,
          workflow
        })
      });

      response = await transactionResponse.json() as CommitWorkflowTransactionResult;
    } catch (error) {
      response = {
        success: false,
        mode: "local",
        message: error instanceof Error ? error.message : "Workflow transaction request failed."
      };
    }

    setIsSubmitting(false);
    setTransactionModeLabel(response.mode === "database" ? "Supabase transaction pilot" : "Local demo transaction");

    if (!response.success || !response.localResult) {
      setTransactionError(response.message);
      return;
    }

    if (selectedDefinition.type === "resolve_workflow_action") {
      store.markWorkflowActionResolved(workflow, response.localResult);
    } else {
      store.applyTransaction(response.localResult);
    }

    setTransactionMessage(response.message);
    setSelectedDefinition(null);
  }

  return (
    <div className={`workflow-transaction-panel${compact ? " workflow-transaction-compact" : ""}`}>
      {latest ? <WorkflowOutcomeBanner result={latest} /> : null}

      {!hasResolved ? (
        <div className="workflow-transaction-actions">
          <div>
            <span className="workflow-label">Workflow actions</span>
            <small><span className="transaction-mode-pill">{transactionModeLabel}</span> Database writes only when explicitly enabled.</small>
          </div>
          <div className="button-row">
            {availableDefinitions.length > 0 ? availableDefinitions.slice(0, compact ? 3 : 4).map((definition) => {
              const permissionCheck = checkWorkflowTransactionPermission(demoUser.role, definition.type, workflow.workflowType);
              const allowed = permissionCheck.allowed;

              return (
                <button
                  className="button button-secondary workflow-transaction-button"
                  data-action-taken={definition.label}
                  data-decision={workflow.requiredDecision.question}
                  data-description={definition.description}
                  data-evidence={JSON.stringify(definition.requiredEvidence.length > 0 ? definition.requiredEvidence : workflow.evidenceNeeded.required)}
                  data-gate-movement={definition.resultingGateMovement}
                  data-label={definition.label}
                  data-owner={workflow.owner}
                  data-short-label={definition.shortLabel}
                  data-signal-detail={workflow.signal.detail}
                  data-signal-title={workflow.signal.title}
                  data-success-message={definition.successMessage}
                  data-transaction-type={definition.type}
                  data-workflow-id={workflow.id}
                  data-workflow-payload={JSON.stringify(workflow)}
                  data-workflow-title={workflow.title}
                  data-role-label={demoUser.title}
                  data-permission-message={permissionCheck.message}
                  disabled={!allowed}
                  key={definition.type}
                  onClick={() => setSelectedDefinition(definition)}
                  title={allowed ? definition.description : permissionCheck.message}
                  type="button"
                >
                  {definition.shortLabel}
                </button>
              );
            }) : null}
          </div>
        </div>
      ) : (
        <p className="muted">Resolved in local demo state. Seed data remains unchanged.</p>
      )}

      <p className="muted">Current role: {demoUser.title}. RBAC is enforced for workflow transaction writes.</p>
      {unavailableReason ? <p className="workflow-action-unavailable">No action available: {unavailableReason}</p> : null}
      {transactionMessage ? <p className="transaction-message">{transactionMessage}</p> : null}
      {transactionError && !selectedDefinition ? <p className="form-error">{transactionError}</p> : null}

      {!compact ? <WorkflowTransactionHistory history={history} /> : null}

      {selectedDefinition ? (
        <WorkflowTransactionModal
          definition={selectedDefinition}
          errorMessage={transactionError}
          isSubmitting={isSubmitting}
          modeLabel={transactionModeLabel}
          onCancel={() => setSelectedDefinition(null)}
          onConfirm={confirmTransaction}
          roleLabel={demoUser.title}
          workflow={workflow}
        />
      ) : null}
    </div>
  );
}
