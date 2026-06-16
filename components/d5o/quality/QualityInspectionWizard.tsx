import { qualityHelperText } from "@/lib/d5o/quality-config";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import type { RybexProject, WorkPackage } from "@/lib/d5o/types";

export function QualityInspectionWizard({ projects, workPackages }: { projects: RybexProject[]; workPackages: WorkPackage[] }) {
  const project = projects[1] ?? projects[0];

  return (
    <div className="wizard-grid">
      <section className="panel wizard-panel">
        <p className="eyebrow">Step 1</p>
        <h2>Project and work package</h2>
        <p className="muted">{qualityHelperText.inspections}</p>
        <div className="form-grid">
          <label>Project<select defaultValue={project?.id}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Work package<select>{workPackages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Inspection type<select defaultValue="Conduit Depth"><option>Conduit Depth</option><option>Fiber Test</option><option>Rack Integration</option><option>Structured Cabling</option><option>Grounding / Bonding</option></select></label>
          <label>Inspection title<input defaultValue="Conduit depth inspection before backfill" /></label>
          <label>Inspector<input defaultValue="Caleb Ortiz" /></label>
          <label>Inspection date<input defaultValue="2026-06-11" type="date" /></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 2</p>
        <h2>Checklist and criteria</h2>
        <div className="form-grid">
          <label>Acceptance criteria<textarea defaultValue="Minimum cover per drawings; warning tape installed; stationed photos before backfill." /></label>
          <label>Checklist items<textarea defaultValue="Depth measured; photos captured; redline station noted." /></label>
          <label>Required photos<textarea defaultValue="Depth tape photo; open trench photo." /></label>
          <label>Required tests<textarea defaultValue="Depth verification; mandrel test after backfill." /></label>
          <label>Closeout required?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 3</p>
        <h2>Results</h2>
        <div className="form-grid">
          <label>Pass/fail result<select defaultValue="Not Recorded"><option>Not Recorded</option><option>Pass</option><option>Pass with Notes</option><option>Fail</option></select></label>
          <label>Deficiencies found<input defaultValue="0" type="number" /></label>
          <label>Test result status<select defaultValue="Pending"><option>Pending</option><option>Complete</option><option>Failed</option></select></label>
          <label>Photos complete?<select defaultValue="No"><option>No</option><option>Yes</option></select></label>
          <label>Reinspection needed?<select defaultValue="No"><option>No</option><option>Yes</option></select></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 4</p>
        <h2>Review and submit</h2>
        <div className="score-card">
          <span className="metric-label">Completeness Score</span>
          <strong>78%</strong>
          <p>Inspection is held until required photos and result status are complete.</p>
        </div>
        <WorkflowOutcomePanel
          workflowType="quality_control"
          signal="Inspection needs evidence before work can be accepted or closed out."
          decision="Submit, save draft, or create a deficiency prompt if results fail."
          action="Record acceptance criteria, pass/fail result, photos, tests, and reinspection need."
          evidence={["Inspection checklist", "Acceptance criteria", "Required photos", "Test results", "Deficiency prompt"]}
          gateMovement="Quality evidence feeds D4 control and D5 acceptance readiness."
          consequence="Missing inspection proof can create rework, billing holds, and closeout rejection."
        />
        <div className="button-row">
          <button className="button button-primary" type="button">Submit Inspection</button>
          <button className="button button-secondary" type="button">Save Draft</button>
        </div>
      </section>
    </div>
  );
}
