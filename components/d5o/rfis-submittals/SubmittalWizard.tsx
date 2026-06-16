"use client";

import { useMemo, useState } from "react";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { SubmittalCard } from "./SubmittalCard";
import { submittalHelperText } from "@/lib/d5o/rfi-submittal-config";
import { projects, workPackages } from "@/lib/d5o/seed-data";
import type { ControlDiscipline, ControlPriority, Submittal } from "@/lib/d5o/types";

export function SubmittalWizard() {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [priority, setPriority] = useState<ControlPriority>("high");
  const [discipline, setDiscipline] = useState<ControlDiscipline>("fiber");
  const project = projects.find((candidate) => candidate.id === projectId);
  const projectWorkPackages = workPackages.filter((workPackage) => workPackage.projectId === projectId);
  const preview = useMemo(
    () => buildPreviewSubmittal({ projectId, projectName: project?.name, priority, discipline }),
    [discipline, priority, project?.name, projectId]
  );

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Project and Package</h2>
        <p className="muted">{submittalHelperText}</p>
        <div className="form-grid">
          <label><span>Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <Field label="Package name" placeholder="Traffic control plan" />
          <Field label="Submittal title" placeholder="HDPE conduit product data" />
          <Field label="Specification section" placeholder="33 82 00" />
          <label><span>Discipline</span><select value={discipline} onChange={(event) => setDiscipline(event.target.value as ControlDiscipline)}><option value="fiber">Fiber</option><option value="underground">Underground</option><option value="structured_cabling">Structured cabling</option><option value="data_center">Data center</option><option value="civil">Civil</option></select></label>
          <Field label="Supplier / vendor" placeholder="Supplier or vendor" />
          <label><span>Related work package</span><select>{projectWorkPackages.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Required Dates and Review</h2>
        <div className="form-grid">
          <Field label="Required date" type="date" />
          <Field label="Planned submission date" type="date" />
          <Field label="Review due date" type="date" />
          <Field label="Reviewer" placeholder="GC/client reviewer" />
          <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as ControlPriority)}><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          <Field label="Revision" placeholder="Rev 0" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Attachments and Requirements</h2>
        <div className="form-grid">
          <TextArea label="Product data / drawings / certifications" placeholder="List documents included in the package." />
          <TextArea label="Closeout linkage" placeholder="Identify tests, certificates, or photos that will be needed for D5 closeout." />
          <TextArea label="Field readiness impact if late" placeholder="Explain what work package or material release is blocked." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Review and Submit</h2>
        <div className="intake-summary-grid">
          <SubmittalCard submittal={preview} />
          <div className="decision-panel">
            <h3>Completeness Preview</h3>
            <p>Submittal is ready when package, spec section, reviewer, required date, attachments, and work-package impact are clear.</p>
            <button className="button button-primary" type="button">Save Draft Submittal</button>
            <small className="muted">Demo only: submittal persistence will be added later.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="information_control"
            signal="Approval package is needed before material release, field start, testing, or closeout acceptance."
            decision="Submit the package, hold for missing attachments, or escalate if it blocks work."
            action="Assemble package documents, reviewer, required dates, and work-package impact."
            evidence={["Product data", "Drawings/certifications", "Specification section", "Reviewer assignment", "Work-package linkage"]}
            gateMovement="Submittal moves into controlled review and field-readiness tracking."
            consequence="Late or rejected submittals can block procurement, mobilization, field execution, and D5 evidence."
          />
        </div>
      </section>
    </form>
  );
}

function buildPreviewSubmittal({
  projectId,
  projectName,
  priority,
  discipline
}: {
  projectId: string;
  projectName?: string;
  priority: ControlPriority;
  discipline: ControlDiscipline;
}): Submittal {
  return {
    id: "draft-submittal",
    projectId,
    projectName: projectName ?? "Draft project",
    submittalNumber: "DRAFT-SUB",
    title: "Draft approval package",
    packageName: "Draft submittal package",
    specificationSection: "Spec section",
    discipline,
    status: "draft",
    priority,
    requiredDate: "2026-06-14",
    reviewDueDate: "2026-06-17",
    reviewer: "GC/client reviewer",
    supplierOrVendor: "Supplier/vendor",
    revision: "Rev 0",
    linkedWorkPackageIds: [],
    linkedMaterialItems: [],
    linkedCloseoutRequirements: [],
    attachments: [],
    nextAction: "Attach required package documents and submit for review.",
    createdAt: "2026-06-10",
    updatedAt: "2026-06-10",
    dueDate: "2026-06-17",
    owner: "Project manager",
    businessImpact: "Late approval can block material release, field start, or closeout evidence."
  };
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return <label><span>{label}</span><input placeholder={placeholder} type={type} /></label>;
}

function TextArea({ label, placeholder }: { label: string; placeholder: string }) {
  return <label className="form-field-wide"><span>{label}</span><textarea placeholder={placeholder} rows={4} /></label>;
}
