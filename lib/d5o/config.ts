import type { D5OPhase } from "./types";

export const d5oPhases = [
  {
    id: "discover",
    label: "D1 - Discover",
    shortLabel: "D1",
    purpose:
      "Qualify the opportunity, understand the GC/client and funding source, evaluate service-line fit, surface pursuit risk, and approve or decline the bid.",
    primaryQuestion: "Should Rybex pursue this work, and what risks must be priced, excluded, or escalated before pursuit?",
    requiredArtifacts: [
      "GC/client fit and payment posture review",
      "Bid invitation or opportunity brief",
      "Preliminary subcontract scope narrative",
      "Pursuit risk screen",
      "Go/no-go approval"
    ],
    gateName: "Pursuit Authorization Gate",
    gateCriteria: [
      "GC/client fit, payment posture, and contract path are understood",
      "Known scope, access, schedule, and commercial risks have accountable owners",
      "Estimator and operations capacity are confirmed",
      "Go/no-go approval is recorded"
    ],
    typicalOwners: ["executive", "operations_leader", "estimator"],
    statusOptions: [
      { id: "screening", label: "Screening", tone: "info" },
      { id: "pursue", label: "Approved to Pursue", tone: "success" },
      { id: "no_bid", label: "No Bid", tone: "neutral" },
      { id: "hold", label: "Hold", tone: "warning" }
    ]
  },
  {
    id: "define",
    label: "D2 - Define",
    shortLabel: "D2",
    purpose:
      "Convert the pursuit into a priced subcontract baseline by defining scope, assumptions, exclusions, estimate, proposal, contract terms, budget, and schedule.",
    primaryQuestion: "Is the scope defined tightly enough to price, contract, baseline, and protect Rybex margin?",
    requiredArtifacts: [
      "Detailed subcontract scope of work",
      "Estimate and basis of estimate",
      "Assumptions and exclusions",
      "Proposal package",
      "Executed or approved contract summary",
      "Scope matrix",
      "Baseline budget",
      "Baseline schedule",
      "Payment and retainage terms",
      "Notice and change order terms",
      "Required submittal register",
      "Required closeout document list",
      "Risk register update",
      "Project team assignments",
      "D3 mobilization handoff checklist started"
    ],
    gateName: "Baseline Approval Gate",
    gateCriteria: [
      "Scope, inclusions, exclusions, and allowances are explicit",
      "Estimate aligns to production assumptions and crew plan",
      "Subcontract risk and flow-down terms have been reviewed",
      "Payment, retainage, notice, and change-order rules are captured",
      "Budget, schedule, and billing baseline are approved",
      "Submittal, closeout, and D3 handoff requirements have owners"
    ],
    typicalOwners: ["estimator", "project_manager", "finance_admin"],
    statusOptions: [
      { id: "estimating", label: "Estimating", tone: "info" },
      { id: "proposal_out", label: "Proposal Out", tone: "warning" },
      { id: "baseline_ready", label: "Baseline Ready", tone: "success" },
      { id: "contract_hold", label: "Contract Hold", tone: "blocked" }
    ]
  },
  {
    id: "prepare",
    label: "D3 - Design / Prepare",
    shortLabel: "D3",
    purpose:
      "Prepare mobilization by clearing safety, quality, access, permits, locates, materials, equipment, crew plan, work packages, and kickoff readiness.",
    primaryQuestion: "Can crews mobilize with approved controls, access, materials, and field-ready work packages?",
    requiredArtifacts: [
      "Mobilization checklist",
      "Safety plan and JHA",
      "Quality inspection plan",
      "Permits, locates, and access confirmation",
      "Material and equipment plan",
      "Crew plan",
      "GC/client kickoff agenda"
    ],
    gateName: "Mobilization Readiness Gate",
    gateCriteria: [
      "Safety, quality, and site-specific controls are approved",
      "Access, permits, locates, materials, and equipment are ready",
      "Crew plan is staffed",
      "Work packages are issued for field execution"
    ],
    typicalOwners: [
      "project_manager",
      "superintendent",
      "safety_manager",
      "quality_manager"
    ],
    statusOptions: [
      { id: "planning", label: "Planning", tone: "info" },
      { id: "blocked", label: "Blocked", tone: "blocked" },
      { id: "ready_to_mobilize", label: "Ready to Mobilize", tone: "success" },
      { id: "field_hold", label: "Field Hold", tone: "critical" }
    ]
  },
  {
    id: "deliver",
    label: "D4 - Deliver",
    shortLabel: "D4",
    purpose:
      "Control field execution through daily reports, production tracking, safety, quality, RFIs, submittals, issues, delays, notices, and change control.",
    primaryQuestion: "Is the field work safe, productive, documented, and commercially protected every day?",
    requiredArtifacts: [
      "Approved work packages",
      "Daily reports",
      "Production tracking",
      "Safety observations",
      "Quality inspections",
      "RFI and submittal log",
      "Delay, issue, and change event log"
    ],
    gateName: "Controlled Execution Gate",
    gateCriteria: [
      "Daily reporting and production records are current",
      "Safety and quality records are active",
      "RFIs, submittals, issues, delays, notices, and changes have owners",
      "Production status is visible to operations"
    ],
    typicalOwners: [
      "project_manager",
      "superintendent",
      "field_supervisor",
      "safety_manager",
      "quality_manager"
    ],
    statusOptions: [
      { id: "executing", label: "Executing", tone: "success" },
      { id: "watch", label: "Watch", tone: "warning" },
      { id: "at_risk", label: "At Risk", tone: "critical" },
      { id: "field_blocked", label: "Field Blocked", tone: "blocked" }
    ]
  },
  {
    id: "close",
    label: "D5 - Document / Close",
    shortLabel: "D5",
    purpose:
      "Prove completion through punch, as-builts, test results, photo evidence, warranties, closeout documents, final billing, retainage, and GC/client acceptance.",
    primaryQuestion: "Can Rybex prove completion, clear acceptance, and collect final payment?",
    requiredArtifacts: [
      "Punch list",
      "As-builts",
      "Test results",
      "Photo evidence",
      "Warranty documents",
      "GC/client closeout package",
      "Final billing support",
      "Acceptance confirmation"
    ],
    gateName: "Final Acceptance Gate",
    gateCriteria: [
      "Completion evidence is organized",
      "Punch and deficiencies are closed or owned",
      "Final billing package is complete",
      "GC/client acceptance and retainage path are documented"
    ],
    typicalOwners: ["project_manager", "quality_manager", "finance_admin"],
    statusOptions: [
      { id: "punch", label: "Punch", tone: "warning" },
      { id: "closeout_packaging", label: "Closeout Packaging", tone: "info" },
      { id: "submitted", label: "Submitted", tone: "success" },
      { id: "acceptance_hold", label: "Acceptance Hold", tone: "blocked" }
    ]
  },
  {
    id: "optimize",
    label: "O - Optimize",
    shortLabel: "O",
    purpose:
      "Capture lessons learned, update production rates, evaluate GC/client/vendor performance, review margin, schedule, safety, and quality, and improve future pursuits.",
    primaryQuestion: "What did this project teach Rybex that should change the next estimate, plan, or subcontract position?",
    requiredArtifacts: [
      "Lessons learned",
      "Production rate update",
      "GC/client and vendor scorecards",
      "Margin and schedule review",
      "Safety and quality review",
      "Improvement actions"
    ],
    gateName: "Operating Learning Gate",
    gateCriteria: [
      "Lessons are captured in reusable terms",
      "Production rates and estimating assumptions are updated",
      "GC/client and vendor feedback is recorded",
      "Improvement actions have owners"
    ],
    typicalOwners: ["operations_leader", "executive", "project_manager"],
    statusOptions: [
      { id: "reviewing", label: "Reviewing", tone: "info" },
      { id: "actions_open", label: "Actions Open", tone: "warning" },
      { id: "improved", label: "Improved", tone: "success" },
      { id: "archived", label: "Archived", tone: "neutral" }
    ]
  }
] satisfies D5OPhase[];

export const d5oPhaseMap = Object.fromEntries(
  d5oPhases.map((phase) => [phase.id, phase])
) as Record<D5OPhase["id"], D5OPhase>;
