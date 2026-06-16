"use client";

import { useMemo, useState } from "react";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { ChangeEventCard } from "./ChangeEventCard";
import { ChangeControlScoreCard } from "./ChangeControlScoreCard";
import { changeCaptureHelperText } from "@/lib/d5o/change-control-config";
import { dailyReports, projects, rfis, workPackages } from "@/lib/d5o/seed-data";
import type { BackupStatus, BillingStatus, ChangeEvent, ChangeEventSource, PricingStatus } from "@/lib/d5o/types";

export function ChangeEventWizard() {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [source, setSource] = useState<ChangeEventSource>("daily_report");
  const [backupStatus, setBackupStatus] = useState<BackupStatus>("partial");
  const [pricingStatus, setPricingStatus] = useState<PricingStatus>("backup_needed");
  const [billingStatus, setBillingStatus] = useState<BillingStatus>("pending_approval");
  const [noticeRequired, setNoticeRequired] = useState(true);
  const project = projects.find((candidate) => candidate.id === projectId);
  const projectReports = dailyReports.filter((report) => report.projectId === projectId);
  const projectRfis = rfis.filter((rfi) => rfi.projectId === projectId);
  const projectWorkPackages = workPackages.filter((workPackage) => workPackage.projectId === projectId);
  const preview = useMemo(
    () => buildPreviewChange({ projectId, projectName: project?.name, source, backupStatus, pricingStatus, billingStatus, noticeRequired }),
    [backupStatus, billingStatus, noticeRequired, pricingStatus, project?.name, projectId, source]
  );

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Project and Source</h2>
        <p className="muted">{changeCaptureHelperText}</p>
        <div className="form-grid">
          <label><span>Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Source type</span><select value={source} onChange={(event) => setSource(event.target.value as ChangeEventSource)}><option value="daily_report">Daily report</option><option value="rfi_response">RFI response</option><option value="changed_condition">Changed condition</option><option value="gc_direction">GC direction</option><option value="access_delay">Access delay</option><option value="material_substitution">Material substitution</option></select></label>
          <label><span>Link daily report</span><select>{projectReports.map((item) => <option key={item.id}>{item.workPackageName} - {item.reportDate}</option>)}</select></label>
          <label><span>Link RFI</span><select>{projectRfis.map((item) => <option key={item.id}>{item.rfiNumber}: {item.title}</option>)}</select></label>
          <label><span>Link work package</span><select>{projectWorkPackages.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
          <Field label="Change title" placeholder="Unmarked utility conflict requiring bore path adjustment" />
          <Field label="Owner" placeholder={project?.projectManager ?? "Change owner"} />
          <Field label="GC contact" placeholder={`${project?.gcClient ?? "GC"} contact`} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Description and Impact</h2>
        <div className="form-grid">
          <TextArea label="Description" placeholder="Changed condition, extra work, or direction summary." />
          <Field label="Cost impact estimate" placeholder="$0" />
          <TextArea label="Schedule impact" placeholder="Days, crew standby, resequence, access window impact." />
          <TextArea label="Work / scope affected" placeholder="Work packages, quantities, method of work, exclusions affected." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Notice and Backup</h2>
        <div className="form-grid">
          <label><span>Notice required?</span><select value={noticeRequired ? "yes" : "no"} onChange={(event) => setNoticeRequired(event.target.value === "yes")}><option value="yes">Yes</option><option value="no">No</option></select></label>
          <Field label="Notice deadline" type="date" />
          <label><span>Backup completeness</span><select value={backupStatus} onChange={(event) => setBackupStatus(event.target.value as BackupStatus)}><option value="missing">Missing</option><option value="partial">Partial</option><option value="complete">Complete</option><option value="verified">Verified</option></select></label>
          <TextArea label="Required backup" placeholder="Photos, daily reports, RFIs, vendor quotes, labor/equipment hours, GC direction." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Pricing and Commercial Status</h2>
        <div className="form-grid">
          <label><span>Pricing status</span><select value={pricingStatus} onChange={(event) => setPricingStatus(event.target.value as PricingStatus)}><option value="backup_needed">Backup needed</option><option value="pricing_in_progress">Pricing in progress</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="disputed">Disputed</option></select></label>
          <Field label="Submitted amount" placeholder="$0" />
          <Field label="Approved amount" placeholder="$0" />
          <Field label="Rejected / disputed amount" placeholder="$0" />
          <label><span>Billing status</span><select value={billingStatus} onChange={(event) => setBillingStatus(event.target.value as BillingStatus)}><option value="pending_approval">Pending approval</option><option value="approved_not_billed">Approved not billed</option><option value="billed">Billed</option><option value="disputed">Disputed</option></select></label>
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 5</p>
        <h2>Review and Decision</h2>
        <div className="intake-summary-grid">
          <ChangeEventCard event={preview} />
          <div className="decision-panel">
            <ChangeControlScoreCard events={[preview]} dailyReports={projectReports} />
            <label><span>Decision</span><select><option>Save as potential change</option><option>Submit notice</option><option>Request pricing</option><option>Submit pricing</option><option>Mark approved</option><option>Mark disputed</option></select></label>
            <button className="button button-primary" type="button">Save Draft Change Event</button>
            <small className="muted">Demo only: change event persistence will be added later.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="change_recovery"
            signal="Field condition, GC direction, access delay, or RFI response may affect entitlement."
            decision="Submit notice, request pricing, price the change, or dispute/hold based on backup."
            action="Protect notice first, then assemble backup and pricing support."
            evidence={["Daily report", "Photos", "RFI or GC direction", "Labor/equipment backup", "Vendor quote", "Pricing record"]}
            gateMovement={noticeRequired ? "Potential change moves into notice-controlled recovery." : "Potential change remains tracked until backup and pricing are complete."}
            consequence="Waiting for final pricing before capture can miss notice deadlines and turn recoverable work into margin leakage."
          />
        </div>
      </section>
    </form>
  );
}

function buildPreviewChange({
  projectId,
  projectName,
  source,
  backupStatus,
  pricingStatus,
  billingStatus,
  noticeRequired
}: {
  projectId: string;
  projectName?: string;
  source: ChangeEventSource;
  backupStatus: BackupStatus;
  pricingStatus: PricingStatus;
  billingStatus: BillingStatus;
  noticeRequired: boolean;
}): ChangeEvent {
  return {
    id: "draft-change",
    projectId,
    projectName: projectName ?? "Draft project",
    changeNumber: "DRAFT-CE",
    title: "Draft change event",
    description: "Capture the changed condition, extra work, delay, or GC direction before pricing is final.",
    status: noticeRequired ? "notice_required" : "potential",
    source,
    sourceRecordIds: [],
    changeType: "changed_condition",
    noticeRequired,
    noticeDeadline: "2026-06-12",
    noticeStatus: noticeRequired ? "required" : "not_required",
    pricingStatus,
    backupStatus,
    scheduleImpact: true,
    costImpactEstimate: 25000,
    submittedAmount: 0,
    approvedAmount: 0,
    rejectedAmount: 0,
    disputedAmount: 0,
    billingStatus,
    owner: "Project manager",
    gcContact: "GC contact",
    requiredAction: "Complete notice, backup, and pricing path.",
    linkedRfiIds: [],
    linkedDailyReportIds: [],
    linkedWorkPackageIds: [],
    attachments: [],
    createdAt: "2026-06-10",
    updatedAt: "2026-06-10",
    valueEstimate: 25000,
    noticeDueDate: "2026-06-12",
    businessImpact: "Early capture protects notice, backup, and entitlement."
  };
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return <label><span>{label}</span><input placeholder={placeholder} type={type} /></label>;
}

function TextArea({ label, placeholder }: { label: string; placeholder: string }) {
  return <label className="form-field-wide"><span>{label}</span><textarea placeholder={placeholder} rows={4} /></label>;
}
