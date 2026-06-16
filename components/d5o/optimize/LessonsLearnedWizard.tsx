"use client";

import { useMemo, useState } from "react";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { evaluateOptimizeControl } from "@/lib/d5o/optimize-control";
import { optimizeHelperText } from "@/lib/d5o/optimize-config";
import {
  gcPerformanceProfiles,
  improvementActions,
  lessonsLearned,
  productionRateRecords,
  projectPerformanceScorecards,
  riskLibraryItems,
  vendorPerformanceProfiles
} from "@/lib/d5o/seed-data";

export function LessonsLearnedWizard() {
  const [projectId, setProjectId] = useState(projectPerformanceScorecards[0]?.projectId ?? "");
  const scorecard = projectPerformanceScorecards.find((item) => item.projectId === projectId) ?? projectPerformanceScorecards[0];
  const summary = useMemo(() => evaluateOptimizeControl({
    scorecards: projectPerformanceScorecards,
    lessons: lessonsLearned,
    productionRates: productionRateRecords,
    gcProfiles: gcPerformanceProfiles,
    vendorProfiles: vendorPerformanceProfiles,
    improvementActions,
    riskLibrary: riskLibraryItems
  }), []);
  const projectRates = productionRateRecords.filter((rate) => rate.sampleProjectIds.includes(projectId));
  const projectLessons = lessonsLearned.filter((lesson) => lesson.projectId === projectId);

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Project and Review Context</h2>
        <div className="form-grid">
          <label><span>Project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projectPerformanceScorecards.map((item) => <option key={item.id} value={item.projectId}>{item.projectName}</option>)}</select></label>
          <Field label="Review date" type="date" />
          <Field label="Review owner" placeholder="Luis Ortega" />
          <TextArea label="Participants" placeholder="PM, estimator, superintendent, finance, safety, quality." />
          <Field label="Project type" placeholder={scorecard.projectType.replaceAll("_", " ")} />
          <Field label="GC / client" placeholder={scorecard.gcClient} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Performance Review</h2>
        <div className="form-grid">
          <Field label="Original contract value" placeholder={String(scorecard.originalContractValue)} />
          <Field label="Final contract value" placeholder={String(scorecard.finalContractValue)} />
          <Field label="Original estimated margin" placeholder={`${scorecard.originalEstimatedMargin}%`} />
          <Field label="Final gross margin" placeholder={`${scorecard.finalGrossMargin}%`} />
          <Field label="Margin variance" placeholder={`${scorecard.marginVariance} pts`} />
          <Field label="Schedule variance" placeholder={`${scorecard.scheduleVarianceDays} days`} />
          <Field label="Production variance" placeholder={`${scorecard.productionVariancePercent}%`} />
          <Field label="Change recovery rate" placeholder={`${scorecard.changeRecoveryRate}%`} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Execution Review</h2>
        <div className="form-grid">
          <TextArea label="What went well" placeholder={scorecard.keyWins.join("\n")} />
          <TextArea label="What failed" placeholder={scorecard.keyFailures.join("\n")} />
          <TextArea label="Root causes" placeholder={projectLessons.map((lesson) => lesson.rootCause).join("\n")} />
          <TextArea label="Safety / quality / documentation" placeholder={`Safety ${scorecard.safetyScore}; quality ${scorecard.qualityScore}; documentation ${scorecard.documentationScore}`} />
          <TextArea label="RFI / change / billing / closeout issues" placeholder={projectLessons.map((lesson) => lesson.impact).join("\n")} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Production Rate Updates</h2>
        <p className="muted">{optimizeHelperText.productionRates}</p>
        <div className="form-grid">
          <TextArea label="Work types reviewed" placeholder={projectRates.map((rate) => rate.workType).join("\n") || "No rate records selected."} />
          <TextArea label="Estimated versus actual rates" placeholder={projectRates.map((rate) => `${rate.workType}: ${rate.estimatedRate} estimated / ${rate.actualRate} actual`).join("\n")} />
          <TextArea label="Recommended future estimating rates" placeholder={projectRates.map((rate) => `${rate.workType}: ${rate.recommendedEstimatingRate} ${rate.unitOfMeasure}`).join("\n")} />
          <TextArea label="Conditions / constraints" placeholder={projectRates.flatMap((rate) => rate.conditions).join("\n")} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 5</p>
        <h2>GC / Vendor Performance</h2>
        <p className="muted">{optimizeHelperText.gcBehavior}</p>
        <div className="form-grid">
          <TextArea label="GC payment and change behavior" placeholder={`${scorecard.gcClient}: GC score ${scorecard.gcPerformanceScore}`} />
          <TextArea label="Access and documentation burden" placeholder="Record access reliability, RFI latency, and documentation friction." />
          <TextArea label="Vendor delivery / quality / response" placeholder={`Vendor performance score: ${scorecard.vendorPerformanceScore}`} />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 6</p>
        <h2>Improvement Actions and Risk Library</h2>
        <p className="muted">{optimizeHelperText.lessons}</p>
        <div className="form-grid">
          <TextArea label="Lessons learned" placeholder={projectLessons.map((lesson) => lesson.title).join("\n")} />
          <TextArea label="Recommended process changes" placeholder={projectLessons.map((lesson) => lesson.recommendedChange).join("\n")} />
          <label><span>Update go/no-go scoring?</span><select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label><span>Update estimating assumptions?</span><select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label><span>Update mobilization checklist?</span><select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
          <label><span>Update work package template?</span><select defaultValue="Yes"><option>Yes</option><option>No</option></select></label>
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 7</p>
        <h2>Review and Close</h2>
        <div className="intake-summary-grid">
          <section className="score-card">
            <span className="metric-label">Operating Improvement Score</span>
            <strong>{summary.operatingImprovementScore}%</strong>
            <p>{summary.requiredActions[0] ?? "Publish review and assign actions."}</p>
          </section>
          <div className="decision-panel">
            <label><span>Decision</span><select defaultValue="assign"><option value="draft">Save draft</option><option value="assign">Assign actions</option><option value="publish">Publish lessons learned</option><option value="implemented">Mark implemented</option><option value="defer">Defer</option></select></label>
            <ul className="plain-list">{summary.nextActions.slice(0, 6).map((action) => <li key={action}>{action}</li>)}</ul>
            <button className="button button-primary" type="button">Save Lessons Learned Review</button>
            <small className="muted">Demo only: persistence will be added during enterprise hardening.</small>
          </div>
          <WorkflowOutcomePanel
            workflowType="optimize_learning"
            signal="Completed work revealed margin, production, GC/vendor, safety, quality, or closeout learning."
            decision="Publish lessons, assign improvement actions, update rates, or defer with reason."
            action="Turn the review into owner-assigned improvements and operating model updates."
            evidence={["Performance scorecard", "Production variance", "Lessons learned", "GC/vendor review", "Improvement actions", "Risk library updates"]}
            gateMovement="Optimize feeds better go/no-go scoring, estimates, mobilization checklists, and work package templates."
            consequence="Lessons that do not update the operating system become meeting notes instead of repeatable improvement."
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
