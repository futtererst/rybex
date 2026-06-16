import type {
  D2GateReadiness,
  ProjectLaunchDecision,
  ProjectSetupArtifact,
  RybexProject,
  ScopeMatrixItem
} from "./types";

export function evaluateD2Gate(project: RybexProject): D2GateReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const missingRequiredArtifacts: string[] = [];
  const requiredApprovals: string[] = [];
  const nextActions: string[] = [];

  if (!["approved", "executed"].includes(project.contractStatus)) {
    blockers.push("Contract summary is not approved or executed.");
    requiredApprovals.push(`Contract review - ${project.financeOwner}`);
    nextActions.push("Resolve contract review, redlines, retainage, notice, and change-order terms.");
  }

  if (!hasCompleteScope(project.scopeMatrix)) {
    blockers.push("Scope matrix is incomplete.");
    nextActions.push("Complete included scope, excluded scope, assumptions, and clarifications.");
  }

  if (project.includedScope.length === 0 || project.excludedScope.length === 0) {
    blockers.push("Included and excluded scope are not both documented.");
  }

  if (project.assumptions.length === 0) {
    warnings.push("Project assumptions are not documented.");
  }

  if (project.baselineBudgetStatus !== "approved") {
    blockers.push("Baseline budget is not approved.");
    requiredApprovals.push(`Budget baseline - ${project.operationsLead}`);
    nextActions.push("Approve labor, material, equipment, subcontractor, and contingency baseline.");
  }

  if (project.baselineScheduleStatus !== "approved") {
    blockers.push("Baseline schedule is not approved.");
    requiredApprovals.push(`Schedule baseline - ${project.projectManager}`);
    nextActions.push("Approve start, finish, milestones, crew loading, and procurement assumptions.");
  }

  if (!project.paymentTerms.billingCycle || project.paymentTerms.notes.length === 0) {
    blockers.push("Payment terms are incomplete.");
  }

  if (project.retainagePercent < 0 || project.retainagePercent > 20) {
    warnings.push("Retainage percentage should be reviewed for commercial reasonableness.");
  }

  if (project.noticeRequirements.length === 0) {
    blockers.push("Notice requirements are not captured.");
    nextActions.push("Capture delay, changed condition, and added-scope notice windows.");
  }

  if (project.changeOrderTerms.length === 0) {
    blockers.push("Change-order terms are not captured.");
  }

  collectMissing(project.requiredSubmittals, missingRequiredArtifacts, "Required submittal");
  collectMissing(
    project.requiredCloseoutDocuments,
    missingRequiredArtifacts,
    "Required closeout document"
  );
  collectMissing(project.setupArtifacts, missingRequiredArtifacts, "D2 setup artifact");

  if (!teamAssigned(project)) {
    blockers.push("Project team assignments are incomplete.");
    nextActions.push("Assign PM, superintendent, estimator, operations, finance, safety, and quality owners.");
  }

  const openFlowDowns = project.flowDownObligations.filter(
    (obligation) => obligation.status !== "complete" && obligation.status !== "waived"
  );

  if (openFlowDowns.length > 0) {
    warnings.push(`${openFlowDowns.length} flow-down obligations still need review.`);
    nextActions.push("Resolve open flow-down obligations before D3 handoff.");
  }

  if (project.risks.length > 0) {
    warnings.push(`${project.risks.length} commercial or launch risks remain active.`);
  }

  const totalChecks = 12;
  const failedChecks =
    blockers.length +
    Math.min(3, missingRequiredArtifacts.length) +
    (warnings.length > 2 ? 1 : 0);
  const readinessPercent = Math.max(0, Math.min(100, Math.round(((totalChecks - failedChecks) / totalChecks) * 100)));
  const recommendedDecision = recommendDecision(project, blockers);

  return {
    readinessPercent,
    readyBoolean: blockers.length === 0 && missingRequiredArtifacts.length === 0,
    missingRequiredArtifacts,
    blockers,
    warnings,
    recommendedDecision,
    requiredApprovals: requiredApprovals.length > 0 ? requiredApprovals : ["D2 gate approvals are current."],
    nextActions: nextActions.length > 0 ? nextActions : ["Record D2 gate approval and start D3 mobilization handoff."]
  };
}

function collectMissing(
  artifacts: ProjectSetupArtifact[],
  missingRequiredArtifacts: string[],
  prefix: string
) {
  artifacts
    .filter(
      (artifact) =>
        artifact.requiredForD3 &&
        artifact.status !== "complete" &&
        artifact.status !== "waived"
    )
    .forEach((artifact) => missingRequiredArtifacts.push(`${prefix}: ${artifact.name}`));
}

function hasCompleteScope(scopeMatrix: ScopeMatrixItem[]) {
  const requiredCategories = ["included", "excluded", "assumption"] as const;

  return requiredCategories.every((category) =>
    scopeMatrix.some(
      (item) =>
        item.category === category && (item.status === "complete" || item.status === "waived")
    )
  );
}

function teamAssigned(project: RybexProject) {
  return Boolean(
    project.projectManager &&
      project.estimator &&
      project.operationsLead &&
      project.financeOwner &&
      project.safetyOwner &&
      project.qualityOwner
  );
}

function recommendDecision(
  project: RybexProject,
  blockers: string[]
): ProjectLaunchDecision {
  if (project.contractStatus === "blocked") {
    return "blocked";
  }

  if (blockers.some((blocker) => blocker.toLowerCase().includes("contract"))) {
    return "hold_for_contract_review";
  }

  if (blockers.some((blocker) => blocker.toLowerCase().includes("scope"))) {
    return "hold_for_scope_clarification";
  }

  if (blockers.some((blocker) => blocker.toLowerCase().includes("budget"))) {
    return "hold_for_budget_baseline";
  }

  if (blockers.some((blocker) => blocker.toLowerCase().includes("schedule"))) {
    return "hold_for_schedule_alignment";
  }

  if (blockers.length > 0) {
    return "blocked";
  }

  return "ready_for_mobilization_planning";
}
