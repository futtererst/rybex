import { getNextBillingSequenceId } from "./billing-v2-events";
import { getBillingEvidenceRecordValue } from "./billing-v2-readiness";
import { formatBillingCurrency } from "./billing-v2-outcomes";
import type {
  BillingBackupPackage,
  BillingHistoricalRecord,
  BillingHistoryEntry,
  BillingOutcomeRecord,
  BillingV2Event,
  BillingV2State
} from "./types";

export type BillingHistoryAppendInput = {
  event: BillingV2Event;
  label: string;
  note: string;
};

export function appendBillingHistoryEntries(
  billingPackage: BillingBackupPackage,
  events: BillingV2Event[],
  history: BillingHistoryAppendInput[],
  occurredAt: string
): BillingBackupPackage {
  const existingHistoryLength = billingPackage.history.length;
  const historyEntries: BillingHistoryEntry[] = history.map((entry, index) => ({
    id: getNextBillingSequenceId(`${billingPackage.id}-history`, existingHistoryLength + index),
    eventType: entry.event.type,
    actorId: entry.event.actorId,
    occurredAt: entry.event.occurredAt,
    label: entry.label,
    note: entry.note,
    fromState: entry.event.fromState,
    toState: entry.event.toState
  }));

  billingPackage.events = [...billingPackage.events, ...events];
  billingPackage.history = [...billingPackage.history, ...historyEntries];
  billingPackage.updatedAt = occurredAt;

  return billingPackage;
}

export function getBillingStateTransitions(billingPackage: BillingBackupPackage): BillingHistoricalRecord["stateTransitions"] {
  const stateTransitions = billingPackage.history
    .filter((entry) => entry.fromState && entry.toState && entry.fromState !== entry.toState)
    .map((entry) => ({
      from: entry.fromState as BillingV2State,
      to: entry.toState as BillingV2State,
      label: entry.label,
      occurredAt: entry.occurredAt
    }));

  if (billingPackage.blockerResolution) {
    stateTransitions.push({
      from: billingPackage.blockerResolution.fromState,
      to: billingPackage.blockerResolution.toState,
      label: "Billing blocker cleared",
      occurredAt: billingPackage.blockerResolution.clearedAt
    });
  }

  return stateTransitions;
}

export function generateBillingHistoricalRecord(
  billingPackage: BillingBackupPackage,
  actorId: string,
  createdAt: string,
  outcomeRecord: BillingOutcomeRecord
): BillingHistoricalRecord {
  if (!billingPackage.reviewTask || !billingPackage.reviewDecision) {
    throw new Error("Review task and decision are required before generating a Billing v2 historical record.");
  }

  return {
    id: `${billingPackage.id}-historical-001`,
    packageId: billingPackage.id,
    recordLabel: `${billingPackage.payApplicationLabel} billing backup package history`,
    workflowName: billingPackage.workflowName,
    businessProcess: billingPackage.businessProcess,
    businessObject: billingPackage.payApplicationLabel,
    owner: billingPackage.owner,
    userInputs: [
      { label: "Backup summary", value: billingPackage.backupSummary ?? "" },
      { label: "Related source record", value: billingPackage.relatedSourceRecord?.label ?? "" },
      { label: "Amount affected", value: formatBillingCurrency(billingPackage.amountAffected ?? 0, billingPackage.currency) },
      { label: "Review note", value: billingPackage.reviewNote ?? "Not entered" },
      { label: "Resolution note", value: billingPackage.resolutionNote ?? "" }
    ],
    evidenceReferences: billingPackage.evidenceRequirements.map((requirement) => ({
      label: requirement.label,
      status: requirement.status,
      value: getBillingEvidenceRecordValue(requirement)
    })),
    reviewTask: billingPackage.reviewTask,
    reviewDecision: billingPackage.reviewDecision,
    stateTransitions: getBillingStateTransitions(billingPackage),
    outcome: outcomeRecord.outcome,
    auditSummary: `${actorId} cleared the billing blocker after commercial review approval. Record is local/demo only.`,
    storageMode: billingPackage.localDemoOnly ? "local_demo" : "database_pilot",
    createdAt
  };
}
