"use client";

import { useMemo, useState } from "react";
import { D3GateReadinessCard } from "@/components/d5o/mobilization/D3GateReadinessCard";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { evaluateD2Gate } from "@/lib/d5o/d2-gate";
import { projects, workPackages } from "@/lib/d5o/seed-data";
import type {
  ArtifactStatus,
  MobilizationDecision,
  MobilizationPlan,
  RybexProject
} from "@/lib/d5o/types";

const d2ReadyProjects = projects.filter((project) => evaluateD2Gate(project).readyBoolean);

export function MobilizationPlanWizard() {
  const [projectId, setProjectId] = useState(d2ReadyProjects[0]?.id ?? "manual");
  const [safetyStatus, setSafetyStatus] = useState<ArtifactStatus>("pending");
  const [accessStatus, setAccessStatus] = useState<ArtifactStatus>("pending");
  const [materialStatus, setMaterialStatus] = useState<ArtifactStatus>("pending");
  const [workPackageStatus, setWorkPackageStatus] = useState<ArtifactStatus>("pending");
  const [decision, setDecision] = useState<MobilizationDecision>("hold_for_safety");

  const project = projects.find((candidate) => candidate.id === projectId);
  const previewPlan = useMemo(
    () =>
      buildPreviewPlan({
        project,
        safetyStatus,
        accessStatus,
        materialStatus,
        workPackageStatus
      }),
    [accessStatus, materialStatus, project, safetyStatus, workPackageStatus]
  );

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Project and Field Start Basics</h2>
        <p className="muted">
          Start from a D2-ready project so mobilization inherits approved scope,
          budget, schedule, and contract baseline controls.
        </p>
        <div className="form-grid">
          <label>
            <span>Select D2-ready project</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {d2ReadyProjects.map((readyProject) => (
                <option key={readyProject.id} value={readyProject.id}>
                  {readyProject.name}
                </option>
              ))}
              <option value="manual">Manual project selection</option>
            </select>
          </label>
          <Field label="Planned mobilization date" type="date" />
          <Field label="Planned field start date" type="date" />
          <Field label="Mobilization owner" placeholder={project?.projectManager ?? "Mobilization owner"} />
          <Field label="Project manager" placeholder={project?.projectManager ?? "Project manager"} />
          <Field label="Superintendent" placeholder={project?.superintendent ?? "Superintendent"} />
          <Field label="Field supervisor" placeholder={project?.superintendent ?? "Field supervisor"} />
          <Field label="Operations lead" placeholder={project?.operationsLead ?? "Operations lead"} />
          <Field label="Safety owner" placeholder={project?.safetyOwner ?? "Safety owner"} />
          <Field label="Quality owner" placeholder={project?.qualityOwner ?? "Quality owner"} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Crew, Equipment, and Materials</h2>
        <div className="form-grid">
          <TextArea label="Crew plan" placeholder="Crew name, supervisor, size, shifts, availability, and coverage gaps." />
          <TextArea label="Equipment list and readiness" placeholder="Bore rigs, lifts, testers, vehicles, tools, calibration, inspections..." />
          <label>
            <span>Material delivery status</span>
            <select value={materialStatus} onChange={(event) => setMaterialStatus(event.target.value as ArtifactStatus)}>
              <option value="complete">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="missing">Missing</option>
            </select>
          </label>
          <TextArea label="Long-lead or shortage risks" placeholder="Fiber reels, conduit, rack hardware, patch panels, owner-furnished gear..." />
          <TextArea label="Storage / staging requirements" placeholder="Yard storage, site cage, secure room, delivery windows, material handling..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Access, Permits, Locates, and Site Readiness</h2>
        <p className="muted">
          Utility locate status must be confirmed before underground work to prevent
          safety incidents, rework, and delay claims.
        </p>
        <div className="form-grid">
          <label>
            <span>Access / permit status</span>
            <select value={accessStatus} onChange={(event) => setAccessStatus(event.target.value as ArtifactStatus)}>
              <option value="complete">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="missing">Missing</option>
            </select>
          </label>
          <TextArea label="Site access and badging" placeholder="Access windows, security, escorts, badges, site readiness dependencies..." />
          <TextArea label="Permits and ROW" placeholder="Municipal permits, ROW, environmental constraints, railroad windows..." />
          <TextArea label="Utility locates" placeholder="Ticket number, expiration, refresh plan, locate gaps..." />
          <TextArea label="Traffic control" placeholder="Lane closures, shoulder work, pedestrian controls, traffic plan approvals..." />
          <TextArea label="GC / site readiness dependencies" placeholder="Predecessor work, laydown, survey, access, outage windows..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Safety Readiness</h2>
        <div className="form-grid">
          <label>
            <span>Safety package status</span>
            <select value={safetyStatus} onChange={(event) => setSafetyStatus(event.target.value as ArtifactStatus)}>
              <option value="complete">Complete</option>
              <option value="pending">Pending</option>
              <option value="missing">Missing</option>
            </select>
          </label>
          <TextArea label="Site-specific safety plan" placeholder="Known hazards, controls, emergency response, escalation path..." />
          <TextArea label="JHA / JSA" placeholder="Task hazards, competent person, traffic, excavation, electrical, lift, PPE..." />
          <TextArea label="Toolbox talk plan" placeholder="First-day topics, crew acknowledgement, daily safety emphasis..." />
          <TextArea label="Training / certification requirements" placeholder="Lift, confined space, excavation, CPR, data center access..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 5</p>
        <h2>Quality and Work Package Readiness</h2>
        <p className="muted">
          Work packages should be clear enough for the field to execute without
          relying on tribal knowledge.
        </p>
        <div className="form-grid">
          <label>
            <span>Work package status</span>
            <select value={workPackageStatus} onChange={(event) => setWorkPackageStatus(event.target.value as ArtifactStatus)}>
              <option value="complete">Ready</option>
              <option value="pending">Pending</option>
              <option value="missing">Missing</option>
            </select>
          </label>
          <TextArea label="Quality inspection plan" placeholder="Inspection points, acceptance criteria, test forms, quality owner..." />
          <TextArea label="Test requirements" placeholder="OTDR, cable certification, mandrel, photo logs, test package naming..." />
          <TextArea label="Photo documentation requirements" placeholder="Before/after, labels, locates, safety controls, restoration, testing evidence..." />
          <TextArea label="Production targets" placeholder="Daily footage, drops, racks, handholes, tests, milestones..." />
          <TextArea label="Required submittals and closeout docs" placeholder="Known before field start so evidence is captured as work is performed." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 6</p>
        <h2>D3 Gate Summary</h2>
        <div className="intake-summary-grid">
          <D3GateReadinessCard plan={previewPlan} project={project} />
          <div className="decision-panel">
            <h3>Field-Start Decision</h3>
            <p>
              D4 delivery should not start until safety, access, locates, materials,
              crew, quality, and work packages are ready.
            </p>
            <label>
              <span>Decision selection</span>
              <select value={decision} onChange={(event) => setDecision(event.target.value as MobilizationDecision)}>
                <option value="approve_field_start">Approve field start</option>
                <option value="hold_for_safety">Hold for safety</option>
                <option value="hold_for_access_or_permits">Hold for access or permits</option>
                <option value="hold_for_materials">Hold for materials</option>
                <option value="hold_for_crew_or_equipment">Hold for crew/equipment</option>
                <option value="hold_for_work_packages">Hold for work packages</option>
                <option value="hold_for_quality_requirements">Hold for quality requirements</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <button className="button button-primary" type="button">
              Save Draft Mobilization
            </button>
            <small className="muted">Demo only: mobilization setup is local until persistence is added.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="mobilization_readiness"
            signal="Field start depends on safety, access, locates, materials, crew, quality, and work-package readiness."
            decision="Approve field start or hold for the specific readiness blocker."
            action="Close the missing safety, access, material, equipment, quality, or work-package item."
            evidence={["JHA / site safety plan", "Utility locate confirmation", "Crew/equipment readiness", "Material status", "Field work package", "Kickoff record"]}
            gateMovement={decision === "approve_field_start" ? "D3 approved for D4 field execution." : "D3 holds field start until blockers are cleared."}
            consequence="Mobilizing before readiness creates safety exposure, unplanned downtime, rework, and unrecoverable standby cost."
          />
        </div>
      </section>
    </form>
  );
}

function buildPreviewPlan({
  project,
  safetyStatus,
  accessStatus,
  materialStatus,
  workPackageStatus
}: {
  project?: RybexProject;
  safetyStatus: ArtifactStatus;
  accessStatus: ArtifactStatus;
  materialStatus: ArtifactStatus;
  workPackageStatus: ArtifactStatus;
}): MobilizationPlan {
  const readyWorkPackages = workPackageStatus === "complete";

  return {
    id: "draft-mobilization",
    projectId: project?.id ?? "manual",
    projectName: project?.name ?? "Manual Mobilization Plan",
    d5oPhase: "prepare",
    readinessStatus: "planning",
    readinessPercent: 0,
    plannedMobilizationDate: "2026-07-01",
    plannedFieldStartDate: "2026-07-05",
    mobilizationOwner: project?.projectManager ?? "Mobilization owner",
    projectManager: project?.projectManager ?? "Project manager",
    superintendent: project?.superintendent ?? "Superintendent",
    fieldSupervisor: project?.superintendent ?? "Field supervisor",
    safetyOwner: project?.safetyOwner ?? "Safety owner",
    qualityOwner: project?.qualityOwner ?? "Quality owner",
    operationsLead: project?.operationsLead ?? "Operations lead",
    crewPlan: { crewName: "Draft crew", supervisor: project?.superintendent ?? "Supervisor", crewSize: 6, availabilityStatus: "complete", notes: "Draft crew plan." },
    equipmentPlan: [{ id: "draft-equipment", name: "Required equipment", status: "complete", owner: "Supervisor", neededDate: "2026-07-01", notes: "Draft equipment plan." }],
    materialPlan: [{ id: "draft-material", name: "Required materials", status: materialStatus, owner: "Project manager", neededDate: "2026-07-01", deliveryStatus: materialStatus === "complete" ? "Confirmed" : "Unconfirmed" }],
    permitAccessPlan: [{ id: "draft-access", name: "Site access and permits", type: "access", status: accessStatus, owner: "Project manager", notes: "Draft access plan." }],
    utilityLocateStatus: { required: true, status: accessStatus, owner: "Field supervisor", notes: "Locate status follows access/permit readiness in preview." },
    trafficControlStatus: { required: true, status: accessStatus, owner: "Safety owner", notes: "Traffic control status follows access/permit readiness in preview." },
    safetyPlanStatus: safetyStatus,
    jhaStatus: safetyStatus,
    qualityPlanStatus: workPackageStatus,
    workPackages: [
      {
        id: "draft-work-package",
        projectId: project?.id ?? "manual",
        name: "Draft Field Work Package",
        location: project?.location ?? "Project location",
        scopeDescription: "Draft scope for field-ready work package.",
        assignedCrew: "Draft crew",
        fieldSupervisor: project?.superintendent ?? "Supervisor",
        plannedStartDate: "2026-07-05",
        plannedFinishDate: "2026-07-12",
        drawings: readyWorkPackages ? ["Drawings attached"] : [],
        specifications: readyWorkPackages ? ["Specifications attached"] : [],
        materials: ["Required materials"],
        equipment: ["Required equipment"],
        safetyNotes: ["Safety notes required"],
        qualityChecks: ["Quality checks required"],
        productionTarget: "Draft target",
        requiredPhotos: ["Progress photos"],
        requiredTests: ["Required tests"],
        status: readyWorkPackages ? "ready_for_field" : "awaiting_inputs",
        blockers: readyWorkPackages ? [] : ["Work package inputs pending"],
        nextAction: "Complete work package inputs."
      }
    ],
    kickoffStatus: { status: "pending", scheduledDate: "2026-07-03", attendees: [], notes: "Kickoff pending." },
    requiredSubmittalsStatus: workPackageStatus,
    procurementStatus: materialStatus,
    blockers: [],
    warnings: ["Draft mobilization preview."],
    requiredApprovals: ["Operations approval", "Safety approval", "Quality approval"],
    nextAction: "Complete D3 readiness before field start.",
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
