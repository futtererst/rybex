import type { OperatingWorkflowType } from "@/lib/d5o/workflow/types";

type RoleContext = {
  audience: string;
  focus: string;
  action: string;
};

export const roleContextByWorkflow: Record<OperatingWorkflowType, RoleContext> = {
  pursuit_control: {
    audience: "Estimator + executive reviewer",
    focus: "Bid fit, risk, capacity, and pursuit decision.",
    action: "Approve, hold, or decline before estimating time is committed."
  },
  contract_baseline: {
    audience: "Project manager + operations leader",
    focus: "Scope, contract terms, budget, schedule, and notice obligations.",
    action: "Clear D2 blockers before mobilization planning."
  },
  mobilization_readiness: {
    audience: "PM + superintendent",
    focus: "Crew, access, locates, materials, safety, and work package readiness.",
    action: "Approve field start or hold for missing readiness evidence."
  },
  field_execution: {
    audience: "Field supervisor + superintendent",
    focus: "Today’s work, report submission, quantities, blockers, and field issues.",
    action: "Submit the daily report and escalate RFI/change signals."
  },
  information_control: {
    audience: "PM + superintendent",
    focus: "RFIs, submittals, response aging, and work-blocking approvals.",
    action: "Escalate overdue answers and link cost/schedule impacts."
  },
  change_recovery: {
    audience: "PM + commercial lead",
    focus: "Notice deadlines, backup, pricing, entitlement, and recovery.",
    action: "Protect notice rights and move approved value toward billing."
  },
  billing_cash_control: {
    audience: "Finance/admin + PM",
    focus: "Billing readiness, cash at risk, retainage, waivers, and backup.",
    action: "Clear billing blockers and recover approved work."
  },
  safety_control: {
    audience: "Safety manager + superintendent",
    focus: "Safety blockers, incidents, observations, and corrective actions.",
    action: "Assign, verify, or escalate safety closure."
  },
  quality_control: {
    audience: "Quality manager + PM",
    focus: "Inspections, tests, deficiencies, punch, and closeout evidence.",
    action: "Verify corrections and clear acceptance blockers."
  },
  closeout_acceptance: {
    audience: "PM + quality + finance",
    focus: "Acceptance evidence, final billing, punch, and retainage release.",
    action: "Submit the package or hold for missing evidence."
  },
  optimize_learning: {
    audience: "Operations leader + executive",
    focus: "Lessons learned, production rates, GC/vendor posture, and improvement actions.",
    action: "Publish actions that improve the next pursuit and project."
  },
  system_readiness: {
    audience: "Admin + implementation owner",
    focus: "Demo readiness, route health, data mode, and implementation boundaries.",
    action: "Verify the platform is safe to show and clear about limitations."
  }
};

export function getRoleContext(workflowType: OperatingWorkflowType) {
  return roleContextByWorkflow[workflowType];
}

type RoleContextBandProps = {
  workflowType: OperatingWorkflowType;
};

export function RoleContextBand({ workflowType }: RoleContextBandProps) {
  const context = roleContextByWorkflow[workflowType];

  return (
    <section className="role-context-band" aria-label="Role context">
      <div>
        <span>Built for</span>
        <strong>{context.audience}</strong>
      </div>
      <div>
        <span>See first</span>
        <strong>{context.focus}</strong>
      </div>
      <div>
        <span>Next move</span>
        <strong>{context.action}</strong>
      </div>
    </section>
  );
}
