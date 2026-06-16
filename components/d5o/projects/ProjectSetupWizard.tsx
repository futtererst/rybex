"use client";

import { useMemo, useState } from "react";
import { D2GateReadinessCard } from "@/components/d5o/projects/D2GateReadinessCard";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { opportunities } from "@/lib/d5o/seed-data";
import { projectTypeLabels, serviceLineLabels } from "@/lib/d5o/opportunity-config";
import type {
  BaselineStatus,
  ContractStatus,
  Opportunity,
  ProjectLaunchDecision,
  RybexProject
} from "@/lib/d5o/types";

const sourceOpportunities = opportunities.filter(
  (opportunity) =>
    opportunity.status === "approved_to_bid" ||
    opportunity.status === "estimating" ||
    opportunity.status === "won" ||
    opportunity.decision === "approve_to_bid"
);

export function ProjectSetupWizard() {
  const [sourceId, setSourceId] = useState(sourceOpportunities[0]?.id ?? "manual");
  const [contractStatus, setContractStatus] = useState<ContractStatus>("under_review");
  const [budgetStatus, setBudgetStatus] = useState<BaselineStatus>("draft");
  const [scheduleStatus, setScheduleStatus] = useState<BaselineStatus>("under_review");
  const [decision, setDecision] = useState<ProjectLaunchDecision>("hold_for_contract_review");

  const source = sourceOpportunities.find((opportunity) => opportunity.id === sourceId);
  const previewProject = useMemo(
    () =>
      buildPreviewProject({
        source,
        contractStatus,
        budgetStatus,
        scheduleStatus,
        decision
      }),
    [budgetStatus, contractStatus, decision, scheduleStatus, source]
  );

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Source and Project Basics</h2>
        <p className="muted">
          Start from an approved pursuit when possible so the D1 decision, risk posture,
          and bid assumptions carry into the D2 baseline.
        </p>
        <div className="form-grid">
          <label>
            <span>Source opportunity</span>
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              {sourceOpportunities.map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.name}
                </option>
              ))}
              <option value="manual">Manual project setup</option>
            </select>
          </label>
          <Field label="Project name" placeholder={source?.name ?? "Manual project name"} />
          <Field label="Project number" placeholder="RYB-26046" />
          <Field label="GC / client" placeholder={source?.gcClient ?? "GC / client"} />
          <Field label="Owner / prime" placeholder={source?.ownerOrPrime ?? "Owner / prime"} />
          <Field label="Location" placeholder={source?.projectLocation ?? "Project location"} />
          <Field label="Project type" placeholder={source ? projectTypeLabels[source.projectType] : "Project type"} />
          <Field label="Service lines" placeholder={source ? source.serviceLines.map((line) => serviceLineLabels[line]).join(", ") : "Service lines"} />
          <Field label="Contract value" placeholder="$1,000,000" />
          <Field label="Project manager" placeholder="Dana Brooks" />
          <Field label="Superintendent" placeholder="Evan Carter" />
          <Field label="Operations lead" placeholder="Luis Ortega" />
          <Field label="Finance owner" placeholder="Tessa Grant" />
          <Field label="Safety owner" placeholder="Nora Fields" />
          <Field label="Quality owner" placeholder="Caleb Ortiz" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Contract Summary</h2>
        <p className="muted">
          Notice requirements determine how quickly Rybex must notify the GC of delay,
          changed conditions, or added scope.
        </p>
        <div className="form-grid">
          <label>
            <span>Contract status</span>
            <select value={contractStatus} onChange={(event) => setContractStatus(event.target.value as ContractStatus)}>
              <option value="draft_received">Draft received</option>
              <option value="under_review">Under review</option>
              <option value="redlines_required">Redlines required</option>
              <option value="approved">Approved</option>
              <option value="executed">Executed</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <Field label="Retainage percent" placeholder="5%" />
          <TextArea label="Payment terms" placeholder="Monthly progress billing, pay-when-paid rules, stored material billing, backup requirements..." />
          <TextArea label="Notice requirements" placeholder="Delay notice, changed condition notice, added scope notice, delivery method, responsible owner..." />
          <TextArea label="Change-order terms" placeholder="Written direction, backup timing, unit rates, T&M documentation, approval path..." />
          <TextArea label="Flow-down obligations" placeholder="LDs, insurance, bonding, wage requirements, safety, documentation, closeout obligations..." />
          <TextArea label="Contract review notes" placeholder="Redlines, unacceptable terms, missing exhibits, business impact..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Scope Matrix</h2>
        <div className="form-grid">
          <TextArea label="Included scope" placeholder="What Rybex agreed to deliver." />
          <TextArea label="Excluded scope" placeholder="What Rybex did not include or priced as allowance." />
          <TextArea label="Assumptions" placeholder="Access, work windows, GC-furnished items, owner approvals..." />
          <TextArea label="Clarifications needed" placeholder="Scope gaps that must be answered before D3." />
          <TextArea label="Owner / GC-furnished items" placeholder="Racks, switches, survey, permits, locates, access badges..." />
          <TextArea label="Rybex-furnished items and dependencies" placeholder="Materials, equipment, crews, testing, documentation, dependencies..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Budget and Schedule Baseline</h2>
        <div className="form-grid">
          <label>
            <span>Baseline budget status</span>
            <select value={budgetStatus} onChange={(event) => setBudgetStatus(event.target.value as BaselineStatus)}>
              <option value="draft">Draft</option>
              <option value="under_review">Under review</option>
              <option value="approved">Approved</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <label>
            <span>Baseline schedule status</span>
            <select value={scheduleStatus} onChange={(event) => setScheduleStatus(event.target.value as BaselineStatus)}>
              <option value="draft">Draft</option>
              <option value="under_review">Under review</option>
              <option value="approved">Approved</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <Field label="Original estimate value" placeholder="$1,000,000" />
          <Field label="Schedule start" type="date" />
          <Field label="Schedule finish" type="date" />
          <TextArea label="Major cost categories" placeholder="Labor, materials, equipment, subcontractors, contingency..." />
          <TextArea label="Milestones and crew loading" placeholder="Start, major phase completion, test package, crew assumptions..." />
          <TextArea label="Procurement assumptions and constraints" placeholder="Long-lead materials, owner-furnished equipment, permits, access windows..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 5</p>
        <h2>Required Artifacts and Handoff</h2>
        <div className="form-grid">
          <TextArea label="Required submittals" placeholder="Material, traffic control, test procedure, safety plans..." />
          <TextArea label="Required closeout documents" placeholder="As-builts, test results, photos, warranties, acceptance forms..." />
          <TextArea label="Required permits / access items" placeholder="Badges, permits, locates, ROW, outage windows..." />
          <TextArea label="Required safety documents" placeholder="JHA, site-specific safety plan, traffic exposure plan..." />
          <TextArea label="Required quality / test documents" placeholder="Inspection plan, test forms, acceptance criteria..." />
          <TextArea label="Required billing documents" placeholder="Schedule of values, backup rules, stored material support..." />
          <TextArea label="D3 mobilization handoff items" placeholder="Kickoff, work packages, material plan, crew plan, equipment plan..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 6</p>
        <h2>D2 Gate Summary</h2>
        <div className="intake-summary-grid">
          <D2GateReadinessCard project={previewProject} />
          <div className="decision-panel">
            <h3>Project Launch Decision</h3>
            <p>
              Mobilization planning should not start until the contract, scope,
              budget, schedule, and D3 handoff artifacts are controlled.
            </p>
            <label>
              <span>Decision selection</span>
              <select value={decision} onChange={(event) => setDecision(event.target.value as ProjectLaunchDecision)}>
                <option value="ready_for_mobilization_planning">Ready for mobilization planning</option>
                <option value="hold_for_contract_review">Hold for contract review</option>
                <option value="hold_for_scope_clarification">Hold for scope clarification</option>
                <option value="hold_for_budget_baseline">Hold for budget baseline</option>
                <option value="hold_for_schedule_alignment">Hold for schedule alignment</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <button className="button button-primary" type="button">
              Save Draft Setup
            </button>
            <small className="muted">Demo only: project setup is local until persistence is added.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="contract_baseline"
            signal="Project setup is not allowed to drift into mobilization without a controlled baseline."
            decision="Can the project move from D2 Define into D3 mobilization planning?"
            action="Complete the contract summary, scope matrix, budget, schedule, and handoff artifacts."
            evidence={["Contract baseline", "Scope matrix", "Budget baseline", "Schedule baseline", "Notice terms", "D3 handoff artifacts"]}
            gateMovement={decision === "ready_for_mobilization_planning" ? "D2 ready for D3 mobilization planning." : "D2 remains held until baseline blockers are resolved."}
            consequence="Uncontrolled scope, notice, or budget terms can reach the field and create margin, schedule, and change recovery exposure."
          />
        </div>
      </section>
    </form>
  );
}

function buildPreviewProject({
  source,
  contractStatus,
  budgetStatus,
  scheduleStatus,
  decision
}: {
  source?: Opportunity;
  contractStatus: ContractStatus;
  budgetStatus: BaselineStatus;
  scheduleStatus: BaselineStatus;
  decision: ProjectLaunchDecision;
}): RybexProject {
  const approved = contractStatus === "approved" || contractStatus === "executed";
  const budgetApproved = budgetStatus === "approved";
  const scheduleApproved = scheduleStatus === "approved";

  return {
    id: "draft-project",
    projectNumber: "RYB-DRAFT",
    name: source?.name ?? "Manual Project Setup",
    sourceOpportunityId: source?.id,
    gcClient: source?.gcClient ?? "GC / client",
    ownerOrPrime: source?.ownerOrPrime,
    location: source?.projectLocation ?? "Project location",
    serviceLines: source?.serviceLines ?? ["infrastructure"],
    projectType: source?.projectType ?? "underground_infrastructure",
    d5oPhase: "define",
    healthStatus: approved && budgetApproved && scheduleApproved ? "on_track" : "watch",
    contractStatus,
    contractBaseline: {
      status: contractStatus,
      summary: "Draft setup preview for D2 gate readiness.",
      reviewedBy: "Finance owner",
      redlineNotes: approved ? [] : ["Contract summary still requires review."]
    },
    contractValue: source?.estimatedValue ?? 1000000,
    originalEstimateValue: source?.estimatedValue ?? 1000000,
    approvedChangeValue: 0,
    pendingChangeValue: 0,
    retainagePercent: 5,
    paymentTerms: {
      billingCycle: approved ? "Monthly progress billing" : "",
      payWhenPaid: true,
      retainagePercent: 5,
      notes: approved ? "Payment terms captured in draft setup." : ""
    },
    noticeRequirements: approved ? [{ trigger: "Delay or changed condition", noticeWindow: "48 hours", deliveryMethod: "GC portal", owner: "Project manager" }] : [],
    changeOrderTerms: approved ? ["Written direction required before extra work."] : [],
    scheduleStart: "2026-07-01",
    scheduleFinish: "2026-09-30",
    baselineScheduleStatus: scheduleStatus,
    baselineBudgetStatus: budgetStatus,
    budgetBaseline: {
      status: budgetStatus,
      originalEstimateValue: source?.estimatedValue ?? 1000000,
      laborBudget: 350000,
      materialBudget: 300000,
      equipmentBudget: 100000,
      subcontractorBudget: 50000,
      contingency: 200000,
      notes: "Draft baseline preview."
    },
    scheduleBaseline: {
      status: scheduleStatus,
      start: "2026-07-01",
      finish: "2026-09-30",
      milestones: ["Mobilize", "Production complete", "Testing accepted"],
      crewLoadingAssumptions: ["Crew plan to be confirmed"],
      materialProcurementAssumptions: ["Procurement assumptions to be confirmed"],
      constraints: ["Access and material release"]
    },
    scopeSummary: source?.scopeSummary ?? "Manual scope summary pending.",
    includedScope: source ? [source.scopeSummary] : [],
    excludedScope: source?.knownExclusions ?? [],
    assumptions: source?.assumptions ?? [],
    clarifications: source?.clarificationsNeeded ?? [],
    scopeMatrix: [
      { id: "draft-in", category: "included", description: "Included scope captured from intake.", owner: "Project manager", status: source ? "complete" : "pending" },
      { id: "draft-out", category: "excluded", description: "Exclusions carried from pursuit.", owner: "Project manager", status: source ? "complete" : "pending" },
      { id: "draft-assume", category: "assumption", description: "Assumptions carried from pursuit.", owner: "Project manager", status: source ? "complete" : "pending" }
    ],
    flowDownObligations: [{ id: "draft-flow", title: "Flow-down review", owner: "Finance owner", status: approved ? "complete" : "pending", businessImpact: "Prevents unreviewed subcontract obligations from reaching the field." }],
    requiredSubmittals: [{ id: "draft-sub", name: "Required submittal register", owner: "Quality owner", status: "pending", requiredForD3: true }],
    requiredCloseoutDocuments: [{ id: "draft-co", name: "Required closeout document list", owner: "Project manager", status: "pending", requiredForD3: false }],
    setupArtifacts: [
      { id: "draft-contract", name: "Approved contract summary", owner: "Finance owner", status: approved ? "complete" : "pending", requiredForD3: true },
      { id: "draft-budget", name: "Baseline budget", owner: "Operations lead", status: budgetApproved ? "complete" : "pending", requiredForD3: true },
      { id: "draft-schedule", name: "Baseline schedule", owner: "Project manager", status: scheduleApproved ? "complete" : "pending", requiredForD3: true },
      { id: "draft-handoff", name: "D3 mobilization handoff checklist started", owner: "Project manager", status: "pending", requiredForD3: true }
    ],
    risks: approved ? [] : ["Contract review incomplete."],
    issues: [],
    projectManager: "Project manager",
    estimator: source?.estimator ?? "Estimator",
    operationsLead: "Operations lead",
    financeOwner: "Finance owner",
    safetyOwner: "Safety owner",
    qualityOwner: "Quality owner",
    nextMilestone: "D2 gate review",
    nextMilestoneDate: "2026-06-20",
    nextAction: "Complete required D2 artifacts before D3 planning.",
    missingArtifacts: [],
    launchDecision: decision,
    createdAt: "2026-06-10",
    updatedAt: "2026-06-10",
    gate: {
      id: "draft-gate",
      phaseId: "define",
      name: "Baseline Approval Gate",
      owner: "Project manager",
      approver: "Operations lead",
      readinessPercent: 0,
      status: "estimating",
      nextRequiredAction: "Complete D2 setup.",
      artifacts: []
    }
  };
}

function Field({
  label,
  placeholder,
  type = "text"
}: {
  label: string;
  placeholder?: string;
  type?: string;
}) {
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
