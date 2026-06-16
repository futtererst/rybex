"use client";

import { useMemo, useState } from "react";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { D4ControlScoreCard } from "./D4ControlScoreCard";
import { fieldDecisionLabels } from "@/lib/d5o/field-execution-config";
import { mobilizationPlans, projects, workPackages } from "@/lib/d5o/seed-data";
import type {
  DailyReport,
  DailyReportStatus,
  FieldExecutionDecision,
  ProductionStatus,
  WorkPackage
} from "@/lib/d5o/types";

const activeWorkPackages = workPackages.filter((workPackage) =>
  ["ready_for_field", "in_progress", "blocked"].includes(workPackage.status)
);

export function DailyReportWizard() {
  const [workPackageId, setWorkPackageId] = useState(activeWorkPackages[0]?.id ?? "");
  const [reportStatus, setReportStatus] = useState<DailyReportStatus>("draft");
  const [productionStatus, setProductionStatus] = useState<ProductionStatus>("on_plan");
  const [photosComplete, setPhotosComplete] = useState(false);
  const [testsComplete, setTestsComplete] = useState(false);
  const [changedCondition, setChangedCondition] = useState(true);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [signoff, setSignoff] = useState(false);
  const [decision, setDecision] = useState<FieldExecutionDecision>("continue_work");

  const workPackage = activeWorkPackages.find((candidate) => candidate.id === workPackageId);
  const project = projects.find((candidate) => candidate.id === workPackage?.projectId);
  const mobilizationPlan = mobilizationPlans.find((plan) =>
    plan.workPackages.some((candidate) => candidate.id === workPackage?.id)
  );
  const previewReport = useMemo(
    () =>
      buildPreviewReport({
        workPackage,
        projectName: project?.name,
        reportStatus,
        productionStatus,
        photosComplete,
        testsComplete,
        changedCondition,
        safetyOpen,
        qualityOpen,
        signoff
      }),
    [
      changedCondition,
      photosComplete,
      productionStatus,
      project?.name,
      qualityOpen,
      reportStatus,
      safetyOpen,
      signoff,
      testsComplete,
      workPackage
    ]
  );

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Project, Work Package, and Date</h2>
        <p className="muted">
          Start daily reporting from a D3-approved work package so planned work,
          safety controls, quality requirements, and closeout evidence stay connected.
        </p>
        <div className="form-grid">
          <label>
            <span>Active work package</span>
            <select value={workPackageId} onChange={(event) => setWorkPackageId(event.target.value)}>
              {activeWorkPackages.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Report date" type="date" />
          <Field label="Supervisor" placeholder={workPackage?.fieldSupervisor ?? "Field supervisor"} />
          <Field label="Submitted by" placeholder={workPackage?.fieldSupervisor ?? "Submitted by"} />
          <Field label="Work area / location" placeholder={workPackage?.location ?? "Work area"} />
          <TextArea label="Planned work for the day" placeholder={workPackage?.scopeDescription ?? "Planned work for the shift."} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Crew, Labor, Equipment, and Materials</h2>
        <div className="form-grid">
          <TextArea label="Crew members and roles" placeholder="Names, roles, company, and supervisor coverage." />
          <TextArea label="Labor hours" placeholder="Regular and overtime hours by person and cost code." />
          <TextArea label="Equipment used" placeholder="Equipment, usage hours, downtime, standby, inspection issues." />
          <TextArea label="Materials received" placeholder="Material quantities, shortages, damage, staging/storage notes." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Work Performed and Quantities</h2>
        <p className="muted">
          Installed quantities support production tracking, billing backup, and closeout documentation.
        </p>
        <div className="form-grid">
          <label>
            <span>Production status</span>
            <select value={productionStatus} onChange={(event) => setProductionStatus(event.target.value as ProductionStatus)}>
              <option value="ahead">Ahead</option>
              <option value="on_plan">On plan</option>
              <option value="behind">Behind</option>
              <option value="blocked">Blocked</option>
              <option value="not_started">Not started</option>
              <option value="complete">Complete</option>
            </select>
          </label>
          <TextArea label="Work performed narrative" placeholder="Actual work completed, areas finished, areas remaining." />
          <TextArea label="Installed quantities" placeholder="Quantity, unit of measure, production target, and cost code." />
          <TextArea label="Next-day plan" placeholder="Crew plan, work area, production target, materials, constraints." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Safety and Site Conditions</h2>
        <div className="form-grid">
          <Field label="Weather" placeholder="Weather or indoor condition" />
          <TextArea label="Site conditions" placeholder="Access, staging, predecessor work, traffic, security, housekeeping." />
          <TextArea label="Toolbox talk / JHA confirmation" placeholder="JHA reviewed, hazards discussed, crew acknowledgement." />
          <label>
            <span>Open safety action?</span>
            <select value={safetyOpen ? "yes" : "no"} onChange={(event) => setSafetyOpen(event.target.value === "yes")}>
              <option value="no">No open safety action</option>
              <option value="yes">Safety action required</option>
            </select>
          </label>
          <TextArea label="Safety observations / incidents" placeholder="Near misses, corrective actions, PPE/access issues, stop-work conditions." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 5</p>
        <h2>Quality, Photos, and Tests</h2>
        <p className="muted">
          Required photos should be captured during work, not reconstructed during closeout.
        </p>
        <div className="form-grid">
          <label>
            <span>Required photos complete?</span>
            <select value={photosComplete ? "yes" : "no"} onChange={(event) => setPhotosComplete(event.target.value === "yes")}>
              <option value="no">Photos incomplete</option>
              <option value="yes">Photos complete</option>
            </select>
          </label>
          <label>
            <span>Required tests complete?</span>
            <select value={testsComplete ? "yes" : "no"} onChange={(event) => setTestsComplete(event.target.value === "yes")}>
              <option value="no">Tests incomplete</option>
              <option value="yes">Tests complete</option>
            </select>
          </label>
          <label>
            <span>Quality deficiency?</span>
            <select value={qualityOpen ? "yes" : "no"} onChange={(event) => setQualityOpen(event.target.value === "yes")}>
              <option value="no">No deficiency</option>
              <option value="yes">Deficiency / rework required</option>
            </select>
          </label>
          <TextArea label="Quality checks and deficiencies" placeholder="Inspection results, acceptance criteria, corrective action, evidence." />
          <TextArea label="Redline / as-built notes" placeholder="Field changes, test references, photo naming, punch items." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 6</p>
        <h2>Delays, Issues, RFIs, and Change Prompts</h2>
        <p className="muted">
          If this issue affects cost, schedule, access, scope, or method of work,
          create or flag a change event before the notice window is missed.
        </p>
        <div className="form-grid">
          <label>
            <span>Changed condition / extra work?</span>
            <select value={changedCondition ? "yes" : "no"} onChange={(event) => setChangedCondition(event.target.value === "yes")}>
              <option value="yes">Prompt RFI/change review</option>
              <option value="no">No prompt required</option>
            </select>
          </label>
          <TextArea label="Delays and blockers" placeholder="Reason, duration, responsible party, schedule/cost impact." />
          <TextArea label="GC direction received" placeholder="Verbal/written direction, who gave it, time, required documentation." />
          <TextArea label="Documentation needed" placeholder="Photos, emails, RFI, change event, standby backup, cost codes." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 7</p>
        <h2>Review and Supervisor Signoff</h2>
        <div className="intake-summary-grid">
          <D4ControlScoreCard
            reports={[previewReport]}
            workPackages={workPackage ? [workPackage] : []}
            mobilizationPlan={mobilizationPlan}
            project={project}
          />
          <div className="decision-panel">
            <h3>Daily Report Decision</h3>
            <label>
              <span>Report status</span>
              <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value as DailyReportStatus)}>
                <option value="draft">Save draft</option>
                <option value="submitted">Submit report</option>
                <option value="supervisor_review">Supervisor review</option>
                <option value="approved">Approved</option>
                <option value="late">Late</option>
              </select>
            </label>
            <label>
              <span>Supervisor signoff</span>
              <select value={signoff ? "signed" : "pending"} onChange={(event) => setSignoff(event.target.value === "signed")}>
                <option value="pending">Pending</option>
                <option value="signed">Signed</option>
              </select>
            </label>
            <label>
              <span>Decision</span>
              <select value={decision} onChange={(event) => setDecision(event.target.value as FieldExecutionDecision)}>
                {Object.entries(fieldDecisionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-primary" type="button">
              Save Daily Report Draft
            </button>
            <small className="muted">Demo only: daily report data is local until persistence is added.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="field_execution"
            signal={changedCondition ? "Daily report captured a changed condition or extra work prompt." : "Daily report captures production, safety, quality, and closeout evidence for the shift."}
            decision="Continue work, escalate the issue, create an RFI/change prompt, or hold work."
            action={changedCondition ? "Create or link the RFI/change record before the notice window is missed." : "Submit the report with quantities, evidence, and supervisor signoff."}
            evidence={["Daily report", "Installed quantities", "Field photos", "Safety observations", "Quality checks", "Supervisor signoff"]}
            gateMovement={changedCondition ? "Field issue moves into controlled RFI/change recovery." : "D4 execution evidence feeds billing and D5 closeout."}
            consequence="Missing same-day field evidence weakens production control, billing backup, change recovery, and closeout proof."
          />
        </div>
      </section>
    </form>
  );
}

function buildPreviewReport({
  workPackage,
  projectName,
  reportStatus,
  productionStatus,
  photosComplete,
  testsComplete,
  changedCondition,
  safetyOpen,
  qualityOpen,
  signoff
}: {
  workPackage?: WorkPackage;
  projectName?: string;
  reportStatus: DailyReportStatus;
  productionStatus: ProductionStatus;
  photosComplete: boolean;
  testsComplete: boolean;
  changedCondition: boolean;
  safetyOpen: boolean;
  qualityOpen: boolean;
  signoff: boolean;
}): DailyReport {
  return {
    id: "draft-daily-report",
    projectId: workPackage?.projectId ?? "manual",
    projectName: projectName ?? "Manual Field Project",
    workPackageId: workPackage?.id ?? "manual-work-package",
    workPackageName: workPackage?.name ?? "Manual Work Package",
    reportDate: "2026-06-10",
    reportStatus,
    submittedBy: workPackage?.fieldSupervisor ?? "Field supervisor",
    supervisor: workPackage?.fieldSupervisor ?? "Field supervisor",
    weather: "Field conditions to be captured",
    siteConditions: "Site access, staging, and constraints to be captured.",
    crewMembers: [{ id: "draft-crew", name: "Crew member", role: "Technician", company: "Rybex" }],
    laborHours: [{ crewMemberId: "draft-crew", name: "Crew member", role: "Technician", regularHours: 8, overtimeHours: 0, costCode: "D4-Field" }],
    equipmentUsed: [{ id: "draft-equipment", name: "Required equipment", hoursUsed: 6, status: "used", notes: "Draft usage." }],
    materialsReceived: [{ id: "draft-material", material: "Required material", quantity: 1, unit: "lot", status: "received", notes: "Draft material receipt." }],
    installedQuantities: productionStatus === "not_started" ? [] : [{ id: "draft-quantity", description: "Installed production", quantity: 100, unit: "LF", productionTarget: 120, costCode: "D4-Production" }],
    workPerformed: "Draft daily report work performed narrative.",
    workAreas: [workPackage?.location ?? "Work area"],
    safetyObservations: safetyOpen
      ? [{ id: "draft-safety", type: "corrective_action", severity: "high", description: "Draft safety observation requires action.", correctiveAction: "Assign owner before next shift.", owner: "Safety owner", status: "open" }]
      : [],
    safetyIncidents: [],
    qualityChecks: qualityOpen
      ? [{ id: "draft-quality", check: "Draft quality check", status: "deficiency", requirement: "Acceptance requirement", evidence: [], owner: "Quality owner", correctiveAction: "Correct and attach evidence." }]
      : [{ id: "draft-quality-pass", check: "Draft quality check", status: "passed", requirement: "Acceptance requirement", evidence: ["Draft evidence"], owner: "Quality owner" }],
    qualityDeficiencies: [],
    photos: [{ id: "draft-photo", description: "Required field photo", category: "progress", captured: photosComplete, requiredForCloseout: true }],
    requiredPhotosComplete: photosComplete,
    requiredTestsComplete: testsComplete,
    delays: changedCondition ? [{ id: "draft-delay", reason: "Draft changed condition delay.", durationHours: 2, responsibleParty: "gc", scheduleImpact: true, costImpact: true, documentationNeeded: "RFI/change backup" }] : [],
    blockers: changedCondition ? [{ id: "draft-blocker", title: "Changed condition needs documentation", severity: "high", owner: "Project manager", businessImpact: "Notice and change recovery are at risk.", requiredAction: "Create or link RFI/change prompt." }] : [],
    changedConditions: changedCondition ? [{ id: "draft-condition", description: "Draft condition affects field method or production.", affectsCost: true, affectsSchedule: true, affectsScope: true, rfiNeeded: true, changeEventNeeded: true, noticeDeadline: "2026-06-12", documentationStatus: "pending" }] : [],
    extraWorkObserved: changedCondition,
    rfiNeeded: changedCondition,
    changeEventNeeded: changedCondition,
    punchItemsCreated: qualityOpen ? ["Draft quality punch item"] : [],
    productionStatus,
    supervisorSignoff: { status: signoff ? "signed" : "pending", signedBy: signoff ? workPackage?.fieldSupervisor : undefined, signedAt: signoff ? "2026-06-10T17:00:00" : undefined, notes: signoff ? "Draft report signed." : "Supervisor signoff pending." },
    gcCoordinationNotes: "Draft GC coordination notes.",
    nextDayPlan: "Draft next-day plan.",
    createdAt: "2026-06-10",
    updatedAt: "2026-06-10"
  };
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return (
    <label>
      <span>{label}</span>
      <input placeholder={placeholder} type={type} />
    </label>
  );
}

function TextArea({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="form-field-wide">
      <span>{label}</span>
      <textarea placeholder={placeholder} rows={4} />
    </label>
  );
}
