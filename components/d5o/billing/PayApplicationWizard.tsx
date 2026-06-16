"use client";

import { useMemo, useState } from "react";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { BillingReadinessCard } from "./BillingReadinessCard";
import { PayApplicationCard } from "./PayApplicationCard";
import { ScheduleOfValuesTable } from "./ScheduleOfValuesTable";
import { billingHelperText } from "@/lib/d5o/billing-config";
import { changeEvents, projects, scheduleOfValues } from "@/lib/d5o/seed-data";
import type {
  BackupStatus,
  LienWaiverStatus,
  PayApplication,
  PayApplicationStatus
} from "@/lib/d5o/types";

export function PayApplicationWizard() {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [status, setStatus] = useState<PayApplicationStatus>("draft");
  const [backupStatus, setBackupStatus] = useState<BackupStatus>("partial");
  const [lienWaiverStatus, setLienWaiverStatus] = useState<LienWaiverStatus>("required");
  const project = projects.find((candidate) => candidate.id === projectId);
  const projectSov = scheduleOfValues.filter((line) => line.projectId === projectId);
  const approvedChanges = changeEvents.filter((event) =>
    event.projectId === projectId && event.approvedAmount > 0
  );
  const preview = useMemo(
    () => buildPreviewPayApplication({ projectId, projectName: project?.name, status, backupStatus, lienWaiverStatus, projectSov, approvedChanges }),
    [approvedChanges, backupStatus, lienWaiverStatus, project?.name, projectId, projectSov, status]
  );

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Project and Billing Period</h2>
        <p className="muted">{billingHelperText}</p>
        <div className="form-grid">
          <label><span>Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <Field label="Billing period start" type="date" />
          <Field label="Billing period end" type="date" />
          <Field label="Pay application number" placeholder="PA-003" />
          <Field label="PM owner" placeholder={project?.projectManager ?? "PM owner"} />
          <Field label="Finance owner" placeholder={project?.financeOwner ?? "Finance owner"} />
          <Field label="Contract value at billing" placeholder="$0" />
          <Field label="Retainage percent" placeholder="5%" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Schedule of Values / Work Completed</h2>
        <p className="muted">Daily reports and quantity records support billing entitlement and reduce rejection risk.</p>
        <ScheduleOfValuesTable lines={projectSov} />
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Approved Changes and Commercial Recovery</h2>
        <div className="form-grid">
          <TextArea label="Approved changes available for billing" placeholder={approvedChanges.map((event) => `${event.changeNumber}: ${event.title}`).join("\n") || "No approved changes yet."} />
          <TextArea label="Approved changes included this cycle" placeholder="List included change events." />
          <TextArea label="Approved changes excluded this cycle" placeholder="Explain why any approved changes are not being billed." />
          <TextArea label="Pending / disputed change exposure" placeholder="List pending, disputed, rejected, or notice-at-risk changes." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Backup Documentation</h2>
        <div className="form-grid">
          <label><span>Backup status</span><select value={backupStatus} onChange={(event) => setBackupStatus(event.target.value as BackupStatus)}><option value="missing">Missing</option><option value="partial">Partial</option><option value="complete">Complete</option><option value="verified">Verified</option></select></label>
          <TextArea label="Daily reports / quantity records" placeholder="Daily reports, installed quantities, production records." />
          <TextArea label="Photos / tests / approved changes" placeholder="Photo evidence, test reports, signed change orders, T&M tickets." />
          <TextArea label="Missing backup list" placeholder="List anything that would cause rejection or payment delay." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 5</p>
        <h2>Retainage and Lien Waivers</h2>
        <p className="muted">Retainage held should remain visible until final release is received.</p>
        <div className="form-grid">
          <Field label="Retainage this period" placeholder="$0" />
          <Field label="Total retainage held" placeholder="$0" />
          <label><span>Lien waiver status</span><select value={lienWaiverStatus} onChange={(event) => setLienWaiverStatus(event.target.value as LienWaiverStatus)}><option value="required">Required</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="accepted">Accepted</option><option value="missing">Missing</option></select></label>
          <Field label="Required waiver amount" placeholder="$0" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 6</p>
        <h2>Review and Submit</h2>
        <div className="intake-summary-grid">
          <PayApplicationCard payApplication={preview} />
          <div className="decision-panel">
            <BillingReadinessCard
              payApplications={[preview]}
              backupItems={[]}
              lienWaivers={[]}
              commercialExposure={[]}
              changeEvents={approvedChanges}
            />
            <label><span>Recommended decision</span><select value={status} onChange={(event) => setStatus(event.target.value as PayApplicationStatus)}><option value="draft">Save draft</option><option value="ready_for_review">Ready for PM review</option><option value="submitted">Submit pay application</option><option value="rejected">Hold for missing backup</option><option value="disputed">Hold for change approval</option></select></label>
            <button className="button button-primary" type="button">Save Draft Pay Application</button>
            <small className="muted">Demo only: pay application persistence will be added later.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="billing_cash_control"
            signal="Completed work and approved changes need billing support before cash is delayed."
            decision="Submit, hold for backup, hold for lien waiver, or hold for change approval."
            action="Tie current billing to SOV lines, quantities, approved changes, waiver status, and backup."
            evidence={["Schedule of values", "Daily reports", "Installed quantities", "Approved change orders", "Billing backup", "Lien waiver"]}
            gateMovement={status === "submitted" ? "Pay application moves into submitted payment follow-up." : "Billing remains held until cash-risk blockers are cleared."}
            consequence="Approved work left unbilled or unsupported increases cash at risk and weakens recovery leverage."
          />
        </div>
      </section>
    </form>
  );
}

function buildPreviewPayApplication({
  projectId,
  projectName,
  status,
  backupStatus,
  lienWaiverStatus,
  projectSov,
  approvedChanges
}: {
  projectId: string;
  projectName?: string;
  status: PayApplicationStatus;
  backupStatus: BackupStatus;
  lienWaiverStatus: LienWaiverStatus;
  projectSov: PayApplication["scheduleOfValues"];
  approvedChanges: typeof changeEvents;
}): PayApplication {
  const currentWorkBilling = projectSov.reduce((total, line) => total + line.currentBilled, 0);
  const currentStoredMaterials = projectSov.reduce((total, line) => total + line.storedMaterials, 0);
  const approvedChangeValue = approvedChanges.reduce((total, event) => total + event.approvedAmount, 0);
  const retainageThisPeriod = Math.round((currentWorkBilling + currentStoredMaterials) * 0.05);

  return {
    id: "draft-pay-application",
    projectId,
    projectName: projectName ?? "Draft project",
    payApplicationNumber: "DRAFT-PA",
    billingPeriodStart: "2026-06-01",
    billingPeriodEnd: "2026-06-30",
    status,
    contractValueAtBilling: projectSov.reduce((total, line) => total + line.revisedValue, 0),
    originalContractValue: projectSov.reduce((total, line) => total + line.originalValue, 0),
    approvedChangeValue,
    pendingChangeValue: 0,
    previousBillings: projectSov.reduce((total, line) => total + line.previousBilled, 0),
    currentWorkBilling,
    currentStoredMaterials,
    currentApprovedChangesBilling: 0,
    totalCompletedAndStoredToDate: projectSov.reduce((total, line) => total + line.totalBilledToDate, 0),
    retainagePercent: 5,
    retainageThisPeriod,
    totalRetainageHeld: retainageThisPeriod,
    amountRequestedThisPeriod: currentWorkBilling + currentStoredMaterials - retainageThisPeriod,
    amountApprovedThisPeriod: 0,
    amountPaidThisPeriod: 0,
    paymentDueDate: "2026-07-25",
    lienWaiverStatus,
    backupStatus,
    scheduleOfValues: projectSov,
    includedChangeEventIds: [],
    excludedApprovedChangeEventIds: approvedChanges.map((event) => event.id),
    missingBackupItems: backupStatus === "verified" || backupStatus === "complete" ? [] : ["Backup documentation incomplete"],
    rejectedLineItems: [],
    disputedItems: [],
    owner: "Finance owner",
    financeOwner: "Finance owner",
    pmOwner: "PM owner",
    nextAction: "Complete backup, waiver, and approved change review before submission.",
    createdAt: "2026-06-10",
    updatedAt: "2026-06-10"
  };
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return <label><span>{label}</span><input placeholder={placeholder} type={type} /></label>;
}

function TextArea({ label, placeholder }: { label: string; placeholder: string }) {
  return <label className="form-field-wide"><span>{label}</span><textarea placeholder={placeholder} rows={4} /></label>;
}
