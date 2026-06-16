import { safetyHelperText } from "@/lib/d5o/safety-config";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import type { RybexProject, WorkPackage } from "@/lib/d5o/types";

export function SafetyRecordWizard({ projects, workPackages }: { projects: RybexProject[]; workPackages: WorkPackage[] }) {
  const project = projects[0];
  const workPackage = workPackages.find((item) => item.projectId === project?.id) ?? workPackages[0];

  return (
    <div className="wizard-grid">
      <section className="panel wizard-panel">
        <p className="eyebrow">Step 1</p>
        <h2>Project and source</h2>
        <div className="form-grid">
          <label>Project<select defaultValue={project?.id}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Work package<select defaultValue={workPackage?.id}>{workPackages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Safety record type<select defaultValue="observation"><option>Observation</option><option>Near miss</option><option>Incident</option><option>Corrective action</option></select></label>
          <label>Date<input defaultValue="2026-06-10" type="date" /></label>
          <label>Location<input defaultValue="Segment A conduit staging area" /></label>
          <label>Reported / observed by<input defaultValue="Jon Reeves" /></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 2</p>
        <h2>Details and severity</h2>
        <p className="muted">{safetyHelperText.correctiveAction}</p>
        <div className="form-grid">
          <label>Description<textarea defaultValue="Blocked access path near conduit staging creates emergency access and material handling exposure." /></label>
          <label>Severity<select defaultValue="high"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
          <label>People/equipment involved<input defaultValue="Bore crew, conduit trailer" /></label>
          <label>Immediate action taken<textarea defaultValue="Held staging movement and notified field supervisor." /></label>
          <label>Stop-work condition?<select defaultValue="No"><option>No</option><option>Yes</option></select></label>
          <label>Photos / attachments<textarea defaultValue="Access path obstruction photo; supervisor note." /></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 3</p>
        <h2>Corrective action</h2>
        <div className="form-grid">
          <label>Corrective action required?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label>Corrective action<textarea defaultValue="Clear access route, verify emergency path, and upload corrected photo." /></label>
          <label>Owner<input defaultValue="Nora Fields" /></label>
          <label>Due date<input defaultValue="2026-06-11" type="date" /></label>
          <label>Verification required?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label>Closeout impact?<select defaultValue="No"><option>No</option><option>Yes</option></select></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 4</p>
        <h2>Review and submit</h2>
        <div className="score-card">
          <span className="metric-label">Completeness Score</span>
          <strong>86%</strong>
          <p>Missing final corrected photo and supervisor verification.</p>
        </div>
        <WorkflowOutcomePanel
          workflowType="safety_control"
          signal="Safety observation requires a corrective action before exposure becomes normalized."
          decision="Submit, save draft, or escalate based on severity and stop-work risk."
          action="Assign the corrective action, due date, verification owner, and closeout impact."
          evidence={["Observation record", "Photos", "Immediate action", "Corrective action", "Verification evidence"]}
          gateMovement="Safety signal moves into controlled corrective action tracking."
          consequence="Unverified safety actions can block field work, increase incident exposure, and weaken closeout proof."
        />
        <div className="button-row">
          <button className="button button-primary" type="button">Submit Safety Record</button>
          <button className="button button-secondary" type="button">Save Draft</button>
          <button className="button button-secondary" type="button">Escalate</button>
        </div>
      </section>
    </div>
  );
}
