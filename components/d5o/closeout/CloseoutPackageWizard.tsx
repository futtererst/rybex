"use client";

import { useMemo, useState } from "react";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { closeoutDecisionLabels, closeoutHelperText } from "@/lib/d5o/closeout-config";
import { evaluateD5Gate } from "@/lib/d5o/d5-gate";
import {
  acceptanceRecords,
  changeEvents,
  closeoutPackages,
  closeoutRequirements,
  correctiveActions,
  dailyReports,
  lienWaivers,
  payApplications,
  projects,
  punchItems,
  qualityDeficiencies,
  rfis,
  submittals,
  testRecords
} from "@/lib/d5o/seed-data";

export function CloseoutPackageWizard() {
  const [projectId, setProjectId] = useState(closeoutPackages[0]?.projectId ?? projects[0]?.id ?? "");
  const closeoutPackage = closeoutPackages.find((item) => item.projectId === projectId) ?? closeoutPackages[0];
  const project = projects.find((item) => item.id === projectId);
  const readiness = useMemo(() => evaluateD5Gate({
    closeoutPackage,
    project,
    requirements: closeoutRequirements,
    acceptanceRecords,
    dailyReports,
    punchItems,
    testRecords,
    qualityDeficiencies,
    correctiveActions,
    rfis,
    submittals,
    changeEvents,
    payApplications,
    lienWaivers
  }), [closeoutPackage, project]);

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Project and Closeout Scope</h2>
        <div className="form-grid">
          <label><span>Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{closeoutPackages.map((item) => <option key={item.id} value={item.projectId}>{item.projectName}</option>)}</select></label>
          <Field label="Closeout package number" placeholder={closeoutPackage.packageNumber} />
          <Field label="Closeout owner" placeholder={closeoutPackage.closeoutOwner} />
          <Field label="Project manager" placeholder={closeoutPackage.projectManager} />
          <Field label="Quality owner" placeholder={closeoutPackage.qualityOwner} />
          <Field label="Finance owner" placeholder={closeoutPackage.financeOwner} />
          <Field label="GC reviewer" placeholder={closeoutPackage.gcReviewer} />
          <Field label="Target submission date" type="date" />
          <TextArea label="Closeout scope summary" placeholder="Summarize work areas, turnover scope, and package boundaries." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Required Documents and Evidence</h2>
        <p className="muted">{closeoutHelperText.evidence}</p>
        <div className="form-grid">
          <TextArea label="As-builts / redlines" placeholder="Final as-built redlines and field markups." />
          <TextArea label="Test and inspection records" placeholder="OTDR, certification, grounding, conduit depth, acceptance inspections." />
          <TextArea label="Required photos" placeholder="Installed condition, depth, label, restoration, acceptance photos." />
          <TextArea label="Warranties / O&M / certifications" placeholder="Vendor warranties, O&M docs, product certifications." />
          <TextArea label="RFI / submittal closeout" placeholder="List open or closed RFIs/submittals that affect closeout." />
          <TextArea label="Archive requirements" placeholder="Package index, naming standard, accepted records." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Punch, Quality, and Safety Closure</h2>
        <div className="form-grid">
          <TextArea label="Open punch items" placeholder={readiness.unresolvedPunchItems.map((item) => item.title).join("\n") || "No open punch items."} />
          <TextArea label="Open deficiencies" placeholder={qualityDeficiencies.filter((item) => item.projectId === projectId && !["closed", "verified"].includes(item.status)).map((item) => item.title).join("\n") || "No open deficiencies."} />
          <TextArea label="Missing tests" placeholder={readiness.missingTestRecords.map((item) => item.title).join("\n") || "No missing tests."} />
          <TextArea label="Safety / quality corrective actions" placeholder={correctiveActions.filter((item) => item.projectId === projectId && item.closeoutImpact && !["closed", "verified"].includes(item.status)).map((item) => item.title).join("\n") || "No closeout-impact corrective actions."} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Commercial Closure</h2>
        <p className="muted">{closeoutHelperText.commercial}</p>
        <div className="form-grid">
          <TextArea label="Final pay application status" placeholder={payApplications.filter((item) => item.projectId === projectId).map((item) => `${item.payApplicationNumber}: ${item.status}`).join("\n")} />
          <TextArea label="Approved changes billed?" placeholder={readiness.unbilledApprovedChanges.map((item) => item.title).join("\n") || "No approved-not-billed changes."} />
          <TextArea label="Lien waiver status" placeholder={lienWaivers.filter((item) => item.projectId === projectId).map((item) => `${item.waiverType}: ${item.status}`).join("\n")} />
          <TextArea label="Retainage release blockers" placeholder={readiness.retainageReleaseBlockers.join("\n") || "No retainage blockers."} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 5</p>
        <h2>Acceptance Review</h2>
        <div className="form-grid">
          <Field label="Acceptance status" placeholder={closeoutPackage.acceptanceStatus.replaceAll("_", " ")} />
          <Field label="GC/client reviewer" placeholder={closeoutPackage.gcReviewer} />
          <TextArea label="Exceptions" placeholder={acceptanceRecords.find((item) => item.packageId === closeoutPackage.id)?.exceptions.join("\n") || "No exceptions recorded."} />
          <TextArea label="Required corrections" placeholder={acceptanceRecords.find((item) => item.packageId === closeoutPackage.id)?.requiredCorrections.join("\n") || "No corrections recorded."} />
          <Field label="Accepted date" type="date" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 6</p>
        <h2>D5 Gate Summary</h2>
        <div className="intake-summary-grid">
          <section className="score-card">
            <span className="metric-label">Closeout Readiness</span>
            <strong>{readiness.closeoutReadinessScore}%</strong>
            <p>{closeoutDecisionLabels[readiness.recommendedDecision]}</p>
          </section>
          <div className="decision-panel">
            <label><span>Recommended decision</span><select defaultValue={readiness.recommendedDecision}>{Object.entries(closeoutDecisionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <ul className="plain-list">
              {readiness.nextActions.slice(0, 6).map((action) => <li key={action}>{action}</li>)}
            </ul>
            <button className="button button-primary" type="button">Save Closeout Package</button>
            <small className="muted">Demo only: closeout package persistence will be added later.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="closeout_acceptance"
            signal="Acceptance package must prove work completion, evidence, commercial closure, and retainage readiness."
            decision="Submit for acceptance or hold for missing documents, punch, tests, billing, or retainage blockers."
            action="Close missing evidence, punch, commercial exceptions, and acceptance corrections."
            evidence={["As-builts/redlines", "Test records", "Inspection evidence", "Punch closure", "Final billing status", "Lien waiver / retainage support"]}
            gateMovement={readiness.readyForSubmissionBoolean ? "D5 package is ready to submit for acceptance." : "D5 remains held until acceptance blockers are cleared."}
            consequence="Incomplete closeout delays acceptance, final billing, retainage release, and archive-quality handoff."
          />
        </div>
      </section>
    </form>
  );
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return <label><span>{label}</span><input placeholder={placeholder} type={type} /></label>;
}

function TextArea({ label, placeholder }: { label: string; placeholder: string }) {
  return <label className="form-field-wide"><span>{label}</span><textarea placeholder={placeholder} rows={4} /></label>;
}
