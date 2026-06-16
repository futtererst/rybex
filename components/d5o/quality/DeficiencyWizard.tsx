import { qualityHelperText } from "@/lib/d5o/quality-config";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import type { QualityInspection, RybexProject, WorkPackage } from "@/lib/d5o/types";

export function DeficiencyWizard({
  projects,
  workPackages,
  inspections
}: {
  projects: RybexProject[];
  workPackages: WorkPackage[];
  inspections: QualityInspection[];
}) {
  const project = projects[2] ?? projects[0];

  return (
    <div className="wizard-grid">
      <section className="panel wizard-panel">
        <p className="eyebrow">Step 1</p>
        <h2>Project and source</h2>
        <p className="muted">{qualityHelperText.deficiencies}</p>
        <div className="form-grid">
          <label>Project<select defaultValue={project?.id}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Work package<select>{workPackages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Record type<select defaultValue="Deficiency"><option>Deficiency</option><option>Punch Item</option></select></label>
          <label>Source inspection<select>{inspections.map((item) => <option key={item.id} value={item.id}>{item.inspectionNumber} - {item.title}</option>)}</select></label>
          <label>Location<input defaultValue="Level 2 data hall" /></label>
          <label>Discovered by<input defaultValue="Caleb Ortiz" /></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 2</p>
        <h2>Details and impact</h2>
        <div className="form-grid">
          <label>Description<textarea defaultValue="Rack labels do not match the approved structured cabling standard and require correction before acceptance." /></label>
          <label>Severity<select defaultValue="High"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
          <label>Closeout impact?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label>Billing impact?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label>Acceptance impact?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label>Photos / attachments<textarea defaultValue="Incorrect label photo; inspection note." /></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 3</p>
        <h2>Correction and verification</h2>
        <div className="form-grid">
          <label>Assigned owner<input defaultValue="Priya Shah" /></label>
          <label>Due date<input defaultValue="2026-06-12" type="date" /></label>
          <label>Correction required<textarea defaultValue="Relabel rack and patch panel per approved standard." /></label>
          <label>Reinspection required?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label>Verification required?<select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label>Next action<textarea defaultValue="Correct labels and upload acceptance photos." /></label>
        </div>
      </section>

      <section className="panel wizard-panel">
        <p className="eyebrow">Step 4</p>
        <h2>Review</h2>
        <div className="score-card">
          <span className="metric-label">Escalation Check</span>
          <strong>Required</strong>
          <p>This item affects acceptance, closeout evidence, and billing support.</p>
        </div>
        <WorkflowOutcomePanel
          workflowType="quality_control"
          signal="Deficiency or punch item affects acceptance, billing support, or closeout evidence."
          decision="Submit the record, save draft, or escalate if acceptance is blocked."
          action="Assign correction, due date, reinspection, verification, and evidence requirements."
          evidence={["Deficiency description", "Photos", "Source inspection", "Corrective action", "Verification record"]}
          gateMovement="Quality issue moves into correction and verification before acceptance."
          consequence="Unverified deficiencies can block D5 acceptance, final billing, and retainage release."
        />
        <div className="button-row">
          <button className="button button-primary" type="button">Submit Record</button>
          <button className="button button-secondary" type="button">Save Draft</button>
        </div>
      </section>
    </div>
  );
}
