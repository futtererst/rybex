import { safetyHelperText } from "@/lib/d5o/safety-config";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import type { RybexProject, WorkPackage } from "@/lib/d5o/types";

export function JhaToolboxWizard({ projects, workPackages }: { projects: RybexProject[]; workPackages: WorkPackage[] }) {
  const project = projects[1] ?? projects[0];

  return (
    <div className="wizard-grid">
      <section className="panel wizard-panel">
        <p className="eyebrow">Step 1</p>
        <h2>Project and work package</h2>
        <p className="muted">{safetyHelperText.jha}</p>
        <div className="form-grid">
          <label>Project<select defaultValue={project?.id}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Work package<select>{workPackages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Record type<select defaultValue="JHA"><option>JHA</option><option>Toolbox Talk</option></select></label>
          <label>Date<input defaultValue="2026-06-11" type="date" /></label>
          <label>Presenter / owner<input defaultValue="Nora Fields" /></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 2</p>
        <h2>Hazards and controls</h2>
        <div className="form-grid">
          <label>Hazards<textarea defaultValue="Unknown utilities; bore pit access; public traffic; equipment backing." /></label>
          <label>Controls<textarea defaultValue="Locate confirmation; barricades; spotter assignment; emergency access route." /></label>
          <label>PPE requirements<textarea defaultValue="Hard hat, Class 3 vest, gloves, eye protection, hearing protection." /></label>
          <label>Competent person required?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label>Competent person assigned<input defaultValue="Pending assignment" /></label>
          <label>Crew acknowledgement status<select defaultValue="Missing"><option>Complete</option><option>Missing</option><option>Partial</option></select></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 3</p>
        <h2>Review</h2>
        <div className="score-card">
          <span className="metric-label">Readiness Status</span>
          <strong>Hold</strong>
          <p>Competent person and crew acknowledgement are required before field start.</p>
        </div>
        <WorkflowOutcomePanel
          workflowType="safety_control"
          signal="JHA/toolbox readiness is incomplete for work that cannot start safely without acknowledgement."
          decision="Submit the JHA/toolbox record or hold field work until acknowledgement is complete."
          action="Confirm hazards, controls, PPE, competent person, emergency contacts, and crew acknowledgement."
          evidence={["Hazard list", "Controls", "PPE requirements", "Competent person assignment", "Crew acknowledgement"]}
          gateMovement="Safety readiness supports D3 field-start approval and D4 execution control."
          consequence="Starting without documented hazards and controls creates safety, legal, and operational exposure."
        />
        <div className="button-row">
          <button className="button button-primary" type="button">Submit JHA / Talk</button>
          <button className="button button-secondary" type="button">Save Draft</button>
        </div>
      </section>
    </div>
  );
}
