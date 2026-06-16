"use client";

import Link from "next/link";
import { EvidenceChecklistPanel } from "@/components/d5o/evidence";
import { StatusChip } from "@/components/d5o/StatusChip";
import { dateLabel, currency } from "@/lib/d5o/presentation";
import { workflowTypeConfig } from "@/lib/d5o/workflow/config";
import { useWorkflowTransactionStore } from "@/lib/d5o/workflow/local-transaction-store";
import type { OperatingWorkflow } from "@/lib/d5o/workflow/types";
import { WorkflowEvidenceList } from "./WorkflowEvidenceList";
import { WorkflowStepper } from "./WorkflowStepper";
import { WorkflowTransactionPanel } from "./WorkflowTransactionPanel";

type WorkflowActionCardProps = {
  workflow: OperatingWorkflow;
  compact?: boolean;
};

export function WorkflowActionCard({ workflow, compact = false }: WorkflowActionCardProps) {
  const store = useWorkflowTransactionStore();
  const localWorkflow = store.state.updatedWorkflowsById[workflow.id] ?? workflow;
  const config = workflowTypeConfig[localWorkflow.workflowType];
  const severityTone = config.toneBySeverity[localWorkflow.severity];

  return (
    <article className={`workflow-action-card workflow-${localWorkflow.severity}${compact ? " workflow-compact" : ""}`}>
      <div className="workflow-card-header">
        <div>
          <p className="eyebrow">{config.label} · {config.shortLabel}</p>
          <h3>{localWorkflow.title}</h3>
        </div>
        <StatusChip label={config.statusLanguage[localWorkflow.resolutionState]} tone={severityTone} />
      </div>

      <WorkflowStepper activeStage={localWorkflow.resolutionState === "needs_decision" ? "decision" : localWorkflow.resolutionState === "ready_for_review" ? "evidence" : localWorkflow.resolutionState === "resolved" ? "gate_movement" : "action"} />

      <div className="workflow-card-grid">
        <div>
          <span className="workflow-label">Signal</span>
          <strong>{localWorkflow.signal.title}</strong>
          <p>{localWorkflow.signal.detail}</p>
        </div>
        <div>
          <span className="workflow-label">Decision Required</span>
          <strong>{localWorkflow.requiredDecision.question}</strong>
          {localWorkflow.requiredDecision.options?.length ? (
            <p>{localWorkflow.requiredDecision.options.slice(0, 3).join(" / ")}</p>
          ) : null}
        </div>
        <div>
          <span className="workflow-label">Required Action</span>
          <strong>{localWorkflow.requiredAction.title}</strong>
          <p>{localWorkflow.requiredAction.detail}</p>
        </div>
      </div>

      {!compact ? <WorkflowEvidenceList evidence={localWorkflow.evidenceNeeded} /> : null}
      {!compact ? (
        <EvidenceChecklistPanel
          requirements={localWorkflow.evidenceNeeded.required.map((title, index) => ({
            id: `workflow-card-evidence-${localWorkflow.id}-${index}`,
            organizationId: "org-rybex-demo",
            workspaceId: "workspace-rybex-demo",
            projectId: localWorkflow.projectId,
            workflowInstanceId: localWorkflow.id,
            sourceModule: localWorkflow.sourceModule,
            sourceRecordType: localWorkflow.sourceRecordType,
            sourceRecordId: localWorkflow.sourceRecordId,
            category: "other",
            title,
            description: localWorkflow.evidenceNeeded.currentState ?? localWorkflow.description,
            required: true,
            status: localWorkflow.resolutionState === "resolved" ? "verified" : localWorkflow.resolutionState === "ready_for_review" ? "under_review" : "missing",
            owner: localWorkflow.owner,
            dueDate: localWorkflow.dueDate,
            requiredForGate: ["pursuit_control", "contract_baseline", "mobilization_readiness"].includes(localWorkflow.workflowType),
            requiredForBilling: ["billing_cash_control", "change_recovery"].includes(localWorkflow.workflowType),
            requiredForCloseout: localWorkflow.workflowType === "closeout_acceptance",
            requiredForChangeRecovery: localWorkflow.workflowType === "change_recovery",
            linkedAttachmentIds: [],
            verificationStatus: localWorkflow.resolutionState === "resolved" ? "verified" : "not_started",
            nextAction: `Provide ${title.toLowerCase()} before ${localWorkflow.nextGateOrStatus.label}.`
          }))}
          title="Evidence required"
        />
      ) : null}

      <div className="workflow-meta-row">
        <span><strong>Owner</strong>{localWorkflow.owner}</span>
        <span><strong>Due</strong>{dateLabel(localWorkflow.dueDate)}</span>
        <span><strong>Next Movement</strong>{localWorkflow.nextGateOrStatus.label}</span>
        {localWorkflow.valueAtRisk ? <span><strong>Value at Risk</strong>{currency.format(localWorkflow.valueAtRisk)}</span> : null}
      </div>

      <div className="workflow-impact">
        <p><strong>Business impact:</strong> {localWorkflow.businessImpact}</p>
        <p><strong>If missed:</strong> {localWorkflow.consequenceIfMissed}</p>
      </div>

      <WorkflowTransactionPanel compact={compact} workflow={localWorkflow} />

      {!compact ? (
        <Link className="button button-primary" href={localWorkflow.targetHref}>
          Resolve Workflow
        </Link>
      ) : null}
    </article>
  );
}
