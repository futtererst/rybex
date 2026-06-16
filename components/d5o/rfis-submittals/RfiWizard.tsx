"use client";

import { useMemo, useState } from "react";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { RfiCard } from "./RfiCard";
import { rfiHelperText } from "@/lib/d5o/rfi-submittal-config";
import { dailyReports, projects, workPackages } from "@/lib/d5o/seed-data";
import type { ControlDiscipline, ControlPriority, RFI } from "@/lib/d5o/types";

export function RfiWizard() {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [priority, setPriority] = useState<ControlPriority>("high");
  const [discipline, setDiscipline] = useState<ControlDiscipline>("underground");
  const [scheduleImpact, setScheduleImpact] = useState(true);
  const [costImpact, setCostImpact] = useState(true);
  const project = projects.find((candidate) => candidate.id === projectId);
  const projectWorkPackages = workPackages.filter((workPackage) => workPackage.projectId === projectId);
  const projectReports = dailyReports.filter((report) => report.projectId === projectId);
  const preview = useMemo(
    () => buildPreviewRfi({ projectId, projectName: project?.name, priority, discipline, scheduleImpact, costImpact }),
    [costImpact, discipline, priority, project?.name, projectId, scheduleImpact]
  );

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Project and Source</h2>
        <p className="muted">{rfiHelperText}</p>
        <div className="form-grid">
          <label><span>Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Related work package</span><select>{projectWorkPackages.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Daily report issue</span><select>{projectReports.map((item) => <option key={item.id}>{item.workPackageName} - {item.reportDate}</option>)}</select></label>
          <Field label="RFI title" placeholder="Utility conflict at bore path" />
          <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as ControlPriority)}><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          <label><span>Discipline</span><select value={discipline} onChange={(event) => setDiscipline(event.target.value as ControlDiscipline)}><option value="underground">Underground</option><option value="fiber">Fiber</option><option value="structured_cabling">Structured cabling</option><option value="data_center">Data center</option><option value="civil">Civil</option></select></label>
          <Field label="Location" placeholder="Bore pit B-17" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Question and References</h2>
        <div className="form-grid">
          <TextArea label="Formal question" placeholder="Ask the GC/client for a clear written decision." />
          <TextArea label="Background / context" placeholder="Explain what the field found and why direction is needed." />
          <Field label="Drawing reference" placeholder="C-411 bore profile B-17" />
          <Field label="Specification reference" placeholder="33 05 23 Utility Boring" />
          <TextArea label="Photos / attachments listed" placeholder="Daily report, photos, sketches, emails, prior direction." />
          <Field label="Clarification needed by" type="date" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Impact Review</h2>
        <div className="form-grid">
          <label><span>Schedule impact?</span><select value={scheduleImpact ? "yes" : "no"} onChange={(event) => setScheduleImpact(event.target.value === "yes")}><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label><span>Cost impact?</span><select value={costImpact ? "yes" : "no"} onChange={(event) => setCostImpact(event.target.value === "yes")}><option value="yes">Yes</option><option value="no">No</option></select></label>
          <TextArea label="Required decision" placeholder="Confirm redesign, access, scope responsibility, or acceptance criteria." />
          <TextArea label="Change event likely?" placeholder="Explain whether this should also create or link a change event." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Review and Submit</h2>
        <div className="intake-summary-grid">
          <RfiCard rfi={preview} />
          <div className="decision-panel">
            <h3>Completeness Preview</h3>
            <p>RFI is ready when the question, references, impact, owner, due date, and linked field records are clear.</p>
            <button className="button button-primary" type="button">Save Draft RFI</button>
            <small className="muted">Demo only: RFI persistence will be added later.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="information_control"
            signal="Field work needs a written clarification before production, scope, or acceptance can continue cleanly."
            decision="Submit the RFI, hold for better references, or link a change event if cost/schedule impact exists."
            action="Attach the question, references, field source, due date, and assigned reviewer."
            evidence={["Formal question", "Drawing/spec reference", "Daily report issue", "Photos or sketches", "Impact review"]}
            gateMovement={costImpact || scheduleImpact ? "Clarification moves into information control and may trigger change recovery." : "Clarification moves into controlled RFI response tracking."}
            consequence="Uncontrolled verbal direction can block production or weaken schedule and change recovery."
          />
        </div>
      </section>
    </form>
  );
}

function buildPreviewRfi({
  projectId,
  projectName,
  priority,
  discipline,
  scheduleImpact,
  costImpact
}: {
  projectId: string;
  projectName?: string;
  priority: ControlPriority;
  discipline: ControlDiscipline;
  scheduleImpact: boolean;
  costImpact: boolean;
}): RFI {
  return {
    id: "draft-rfi",
    projectId,
    projectName: projectName ?? "Draft project",
    rfiNumber: "DRAFT-RFI",
    title: "Draft field clarification",
    question: "Formal question will be captured here with drawing/spec references and field context.",
    status: "draft",
    priority,
    discipline,
    specificationReference: "Specification reference",
    drawingReference: "Drawing reference",
    location: "Field location",
    submittedBy: "Project manager",
    assignedTo: "GC reviewer",
    dueDate: "2026-06-12",
    scheduleImpact,
    costImpact,
    linkedDailyReportIds: [],
    linkedWorkPackageIds: [],
    linkedChangeEventIds: [],
    attachments: [],
    requiredDecision: "Written direction required.",
    nextAction: "Attach references and submit to the assigned reviewer.",
    createdAt: "2026-06-10",
    updatedAt: "2026-06-10",
    owner: "Project manager",
    businessImpact: "Unanswered field clarification can stop production or weaken change recovery."
  };
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return <label><span>{label}</span><input placeholder={placeholder} type={type} /></label>;
}

function TextArea({ label, placeholder }: { label: string; placeholder: string }) {
  return <label className="form-field-wide"><span>{label}</span><textarea placeholder={placeholder} rows={4} /></label>;
}
