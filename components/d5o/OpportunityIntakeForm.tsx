"use client";

import { useMemo, useState } from "react";
import { GoNoGoScoreCard } from "@/components/d5o/GoNoGoScoreCard";
import { WorkflowOutcomePanel } from "@/components/d5o/workflow/WorkflowOutcomePanel";
import { calculateGoNoGo } from "@/lib/d5o/go-no-go";
import {
  projectTypeLabels,
  serviceLineLabels
} from "@/lib/d5o/opportunity-config";
import type {
  GoNoGoDimensionKey,
  Opportunity,
  OpportunityProjectType,
  OpportunityServiceLine,
  PursuitDecision
} from "@/lib/d5o/types";

const projectTypes = Object.keys(projectTypeLabels) as OpportunityProjectType[];
const serviceLines = Object.keys(serviceLineLabels) as OpportunityServiceLine[];

const dimensionCopy: Record<GoNoGoDimensionKey, { label: string; help: string }> = {
  strategic_fit: {
    label: "Strategic fit",
    help: "Service-line fit, GC/client value, repeat work potential, and region fit."
  },
  execution_fit: {
    label: "Execution fit",
    help: "Crew, equipment, schedule, material, access, and drawing/spec maturity."
  },
  commercial_fit: {
    label: "Commercial fit",
    help: "Margin, payment terms, retainage, change behavior, bid effort, and contract risk."
  },
  risk_exposure: {
    label: "Risk exposure",
    help: "Safety, underground risk, permits/ROW, weather, schedule penalties, and documentation burden."
  }
};

type ScoreState = Record<GoNoGoDimensionKey, number>;

export function OpportunityIntakeForm() {
  const [scores, setScores] = useState<ScoreState>({
    strategic_fit: 4,
    execution_fit: 3,
    commercial_fit: 3,
    risk_exposure: 3
  });
  const [decision, setDecision] = useState<PursuitDecision>("pending");

  const draftOpportunity = useMemo<Opportunity>(
    () => ({
      id: "draft-opportunity",
      name: "Draft Opportunity Intake",
      gcClient: "GC / client to be confirmed",
      ownerOrPrime: "Owner or prime to be confirmed",
      projectLocation: "Project location to be confirmed",
      serviceLines: ["infrastructure", "fiber_splicing_testing"],
      projectType: "underground_infrastructure",
      estimatedValue: 1000000,
      bidDueDate: "2026-06-24",
      receivedDate: "2026-06-10",
      status: decision === "approve_to_bid" ? "approved_to_bid" : "awaiting_go_no_go",
      d5oPhase: "discover",
      pursuitOwner: "Pursuit owner",
      estimator: "Estimator",
      operationsReviewer: "Operations reviewer",
      safetyReviewer: "Safety reviewer",
      financeReviewer: "Finance reviewer",
      probability: 50,
      goNoGoScore: 0,
      riskLevel: "moderate",
      decision,
      nextAction: "Complete D1 intake, resolve clarifications, and record pursuit decision.",
      nextActionOwner: "Pursuit owner",
      documentsReceived: ["Drawings", "Specifications", "Bid Form"],
      addendaCount: 0,
      scopeSummary: "Draft scope summary will be captured here.",
      knownExclusions: ["Unpriced utility conflicts", "Permit fees by others"],
      assumptions: ["GC provides access and drawing updates through addenda."],
      clarificationsNeeded: ["Payment terms", "Access windows", "Drawing/spec maturity"],
      riskFactors: [
        {
          id: "draft-risk",
          category: "commercial",
          title: "Draft payment and retainage review",
          severity: scores.commercial_fit <= 2 ? "high" : "moderate",
          rationale: "Payment terms and retainage need review before D1 approval.",
          mitigation: "Assign finance review before estimator starts full takeoff.",
          owner: "Finance reviewer"
        }
      ],
      requiredReviews: [
        {
          id: "draft-ops-review",
          label: "Operations fit review",
          owner: "Operations reviewer",
          role: "operations_leader",
          status: scores.execution_fit >= 4 ? "complete" : "in_review"
        },
        {
          id: "draft-finance-review",
          label: "Payment and contract posture review",
          owner: "Finance reviewer",
          role: "finance_admin",
          status: scores.commercial_fit >= 4 ? "complete" : "in_review"
        }
      ],
      scoring: {
        strategic_fit: {
          score: scores.strategic_fit,
          label: dimensionCopy.strategic_fit.label,
          rationale: scoreRationale("strategic", scores.strategic_fit)
        },
        execution_fit: {
          score: scores.execution_fit,
          label: dimensionCopy.execution_fit.label,
          rationale: scoreRationale("execution", scores.execution_fit)
        },
        commercial_fit: {
          score: scores.commercial_fit,
          label: dimensionCopy.commercial_fit.label,
          rationale: scoreRationale("commercial", scores.commercial_fit)
        },
        risk_exposure: {
          score: scores.risk_exposure,
          label: dimensionCopy.risk_exposure.label,
          rationale: scoreRationale("risk", scores.risk_exposure)
        }
      },
      createdAt: "2026-06-10",
      updatedAt: "2026-06-10"
    }),
    [decision, scores]
  );

  const scoreResult = calculateGoNoGo(draftOpportunity);

  return (
    <form className="intake-form">
      <section className="panel intake-section">
        <p className="eyebrow">Step 1</p>
        <h2>Opportunity Basics</h2>
        <p className="muted">
          Capture enough facts to know who is asking, what is due, and whether Rybex
          should spend estimating time.
        </p>
        <div className="form-grid">
          <Field label="Opportunity name" placeholder="I-77 Fiber Backbone Expansion - Phase 2" />
          <Field label="GC / client" placeholder="Carolina Prime Infrastructure" />
          <Field label="Owner / prime if different" placeholder="BlueRidge Carrier Networks" />
          <Field label="Location" placeholder="Charlotte, NC" />
          <label>
            <span>Project type</span>
            <select defaultValue="underground_infrastructure">
              {projectTypes.map((type) => (
                <option key={type} value={type}>
                  {projectTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Service lines</span>
            <select defaultValue={["infrastructure", "fiber_splicing_testing"]} multiple>
              {serviceLines.map((line) => (
                <option key={line} value={line}>
                  {serviceLineLabels[line]}
                </option>
              ))}
            </select>
          </label>
          <Field label="Estimated value" placeholder="$1,500,000" />
          <Field label="Bid due date" type="date" />
          <Field label="Received date" type="date" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 2</p>
        <h2>Scope and Documents</h2>
        <div className="form-grid">
          <TextArea label="Scope summary" placeholder="Describe requested subcontract scope, work limits, and known deliverables." />
          <TextArea label="Documents received" placeholder="Drawings, specifications, bid form, geotech, route maps, addenda..." />
          <label>
            <span>Drawings/specs received</span>
            <select defaultValue="partial">
              <option value="complete">Complete enough for bid</option>
              <option value="partial">Partial or preliminary</option>
              <option value="missing">Missing or unclear</option>
            </select>
          </label>
          <Field label="Addenda count" type="number" placeholder="0" />
          <TextArea label="Known exclusions" placeholder="Permits, utility relocations, rock excavation, owner-furnished equipment..." />
          <TextArea label="Assumptions" placeholder="Access, work windows, testing format, GC-provided survey, client-furnished materials..." />
          <TextArea label="Clarifications needed" placeholder="Payment terms, drawing maturity, access windows, flow-down terms..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 3</p>
        <h2>Fit and Resource Review</h2>
        <div className="form-grid">
          <ScoreSlider id="strategic_fit" scores={scores} setScores={setScores} />
          <ScoreSlider id="execution_fit" scores={scores} setScores={setScores} />
          <Field label="Crew availability" placeholder="Available with two-week notice" />
          <Field label="Equipment availability" placeholder="Bore rig, bucket truck, fusion splicers..." />
          <Field label="Schedule feasibility" placeholder="Feasible with night shift premium" />
          <Field label="Region / geographic fit" placeholder="Charlotte metro / Carolinas" />
          <Field label="Estimator assignment" placeholder="Marcus Lee" />
          <Field label="Operations reviewer" placeholder="Luis Ortega" />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 4</p>
        <h2>Risk Review</h2>
        <div className="form-grid">
          <ScoreSlider id="commercial_fit" scores={scores} setScores={setScores} />
          <ScoreSlider id="risk_exposure" scores={scores} setScores={setScores} />
          <TextArea label="Safety exposure" placeholder="Traffic, excavation, rooftop, confined space, energized environment..." />
          <TextArea label="Utility / underground risk" placeholder="Unknown utilities, potholing, bore profile, rock, ROW constraints..." />
          <TextArea label="Permitting / ROW risk" placeholder="Permits, railroad crossings, municipal windows, easements, right-of-way limits..." />
          <TextArea label="Access / site readiness" placeholder="Badging, escort rules, outage windows, building access, site logistics..." />
          <TextArea label="Material / long-lead risk" placeholder="Conduit, fiber, cabinets, racks, owner-furnished equipment, delivery dates..." />
          <TextArea label="Payment / retainage risk" placeholder="Pay-when-paid, retainage percentage, grant funding, backup requirements..." />
          <TextArea label="Contract / flow-down risk" placeholder="LDs, indemnity, notice windows, schedule penalties, documentation burden..." />
          <TextArea label="Documentation burden" placeholder="Daily reports, test packages, as-builts, photo logs, grant compliance, closeout evidence..." />
        </div>
      </section>

      <section className="panel intake-section">
        <p className="eyebrow">Step 5</p>
        <h2>Go/No-Go Summary</h2>
        <div className="intake-summary-grid">
          <GoNoGoScoreCard result={scoreResult} />
          <div className="decision-panel">
            <h3>Pursuit Decision</h3>
            <p>
              Estimating resources should not be committed until the D1 pursuit gate
              is approved or a hold/no-bid decision is recorded.
            </p>
            <label>
              <span>Decision selection</span>
              <select
                value={decision}
                onChange={(event) => setDecision(event.target.value as PursuitDecision)}
              >
                <option value="pending">Pending review</option>
                <option value="approve_to_bid">Approve to bid</option>
                <option value="hold_for_clarification">Hold for clarification</option>
                <option value="decline_no_bid">Decline / no-bid</option>
              </select>
            </label>
            <button className="button button-primary" type="button">
              Save Draft Intake
            </button>
            <small className="muted">
              Demo only: this draft is local to the page until a data layer is added.
            </small>
          </div>
          <WorkflowOutcomePanel
            workflowType="pursuit_control"
            signal="Bid opportunity needs D1 discipline before estimating resources are committed."
            decision="Pursue, hold for clarification, or no-bid."
            action="Record the go/no-go decision with score detail and reviewer notes."
            evidence={["Go/no-go score", "Risk factors", "Required reviewer notes", "Clarifications needed"]}
            gateMovement={decision === "approve_to_bid" ? "D1 approved to bid and ready for D2 setup if awarded." : "D1 remains controlled until the pursuit decision is resolved."}
            consequence="Weak pursuit discipline spends estimating capacity on work that may not fit Rybex risk, margin, or execution posture."
          />
        </div>
      </section>
    </form>
  );
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

function ScoreSlider({
  id,
  scores,
  setScores
}: {
  id: GoNoGoDimensionKey;
  scores: ScoreState;
  setScores: (scores: ScoreState) => void;
}) {
  const copy = dimensionCopy[id];

  return (
    <label>
      <span>
        {copy.label}: {scores[id]}/5
      </span>
      <input
        max={5}
        min={1}
        onChange={(event) =>
          setScores({
            ...scores,
            [id]: Number(event.target.value)
          })
        }
        type="range"
        value={scores[id]}
      />
      <small className="muted">{copy.help}</small>
    </label>
  );
}

function scoreRationale(area: string, score: number) {
  if (score >= 4) {
    return `${area} conditions are favorable enough to support pursuit if D1 approvals are recorded.`;
  }

  if (score === 3) {
    return `${area} conditions are workable but need clarification before estimating resources are committed.`;
  }

  return `${area} conditions create material pursuit risk and require mitigation or no-bid consideration.`;
}
