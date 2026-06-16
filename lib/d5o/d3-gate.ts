import { evaluateD2Gate } from "./d2-gate";
import type {
  D3GateReadiness,
  MobilizationDecision,
  MobilizationPlan,
  RybexProject
} from "./types";

export function evaluateD3Gate(
  plan: MobilizationPlan,
  project?: RybexProject
): D3GateReadiness {
  const missingRequiredItems: string[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [...plan.warnings];
  const nextActions: string[] = [];
  const requiredApprovals = [...plan.requiredApprovals];

  if (project) {
    const d2Readiness = evaluateD2Gate(project);
    if (!d2Readiness.readyBoolean) {
      blockers.push("D2 baseline is not approved for mobilization planning.");
      nextActions.push("Resolve D2 contract, scope, budget, and schedule blockers before field start.");
    }
  }

  if (!plan.projectManager || !plan.superintendent) {
    blockers.push("Project manager and superintendent assignments are incomplete.");
  }

  if (plan.crewPlan.availabilityStatus !== "complete") {
    blockers.push("Crew plan is not complete.");
    nextActions.push("Confirm crew, supervisor coverage, and labor availability.");
  }

  const missingEquipment = plan.equipmentPlan.filter((item) => item.status !== "complete" && item.status !== "waived");
  const missingMaterials = plan.materialPlan.filter((item) => item.status !== "complete" && item.status !== "waived");
  const missingAccess = plan.permitAccessPlan.filter((item) => item.status !== "complete" && item.status !== "waived");

  missingEquipment.forEach((item) => missingRequiredItems.push(`Equipment: ${item.name}`));
  missingMaterials.forEach((item) => missingRequiredItems.push(`Material: ${item.name}`));
  missingAccess.forEach((item) => missingRequiredItems.push(`Permit/access: ${item.name}`));

  if (missingEquipment.length > 0) {
    blockers.push("Equipment readiness is incomplete.");
  }

  if (missingMaterials.length > 0 || plan.procurementStatus !== "complete") {
    blockers.push("Material or procurement readiness is incomplete.");
    nextActions.push("Confirm material delivery, shortages, and staging plan.");
  }

  if (missingAccess.length > 0) {
    blockers.push("Site access or permit readiness is incomplete.");
    nextActions.push("Confirm site access, permits, badging, ROW, and GC readiness.");
  }

  if (plan.utilityLocateStatus.required && plan.utilityLocateStatus.status !== "complete") {
    blockers.push("Utility locates are not confirmed.");
    missingRequiredItems.push("Utility locate confirmation");
  }

  if (plan.trafficControlStatus.required && plan.trafficControlStatus.status !== "complete") {
    blockers.push("Traffic control requirements are not confirmed.");
    missingRequiredItems.push("Traffic control plan");
  }

  if (plan.safetyPlanStatus !== "complete" || plan.jhaStatus !== "complete") {
    blockers.push("Safety plan or JHA/JSA is incomplete.");
    missingRequiredItems.push("Site-specific safety plan and JHA/JSA");
    nextActions.push("Complete safety package before approving field start.");
  }

  if (plan.qualityPlanStatus !== "complete") {
    blockers.push("Quality inspection/test plan is incomplete.");
    missingRequiredItems.push("Quality inspection/test plan");
  }

  if (plan.requiredSubmittalsStatus === "missing") {
    blockers.push("Required submittal status is unknown or missing.");
  }

  const notReadyPackages = plan.workPackages.filter(
    (workPackage) =>
      workPackage.status !== "ready_for_field" &&
      workPackage.status !== "in_progress" &&
      workPackage.status !== "complete"
  );

  if (notReadyPackages.length > 0) {
    blockers.push("One or more work packages are not field-ready.");
    notReadyPackages.forEach((workPackage) =>
      missingRequiredItems.push(`Work package: ${workPackage.name}`)
    );
    nextActions.push("Finish work packages with drawings, specs, materials, equipment, safety, quality, and production targets.");
  }

  if (plan.kickoffStatus.status !== "complete") {
    warnings.push("Kickoff is not complete.");
  }

  plan.blockers.forEach((blocker) => blockers.push(blocker.title));

  const totalChecks = 15;
  const failedChecks =
    blockers.length +
    Math.min(4, missingRequiredItems.length) +
    (warnings.length > 2 ? 1 : 0);
  const readinessPercent = Math.max(
    0,
    Math.min(100, Math.round(((totalChecks - failedChecks) / totalChecks) * 100))
  );

  const recommendedDecision = recommendDecision(blockers, missingRequiredItems);

  return {
    readinessPercent,
    readyBoolean: blockers.length === 0 && missingRequiredItems.length === 0,
    missingRequiredItems,
    blockers,
    warnings,
    recommendedDecision,
    requiredApprovals:
      requiredApprovals.length > 0 ? requiredApprovals : ["D3 field-start approvals are assigned."],
    nextActions:
      nextActions.length > 0 ? nextActions : ["Approve field start and hand off to D4 delivery controls."]
  };
}

function recommendDecision(blockers: string[], missingItems: string[]): MobilizationDecision {
  const text = [...blockers, ...missingItems].join(" ").toLowerCase();

  if (blockers.some((blocker) => blocker.toLowerCase().includes("d2 baseline"))) {
    return "blocked";
  }

  if (text.includes("safety") || text.includes("jha") || text.includes("jsa")) {
    return "hold_for_safety";
  }

  if (text.includes("access") || text.includes("permit") || text.includes("locate") || text.includes("traffic")) {
    return "hold_for_access_or_permits";
  }

  if (text.includes("material") || text.includes("procurement")) {
    return "hold_for_materials";
  }

  if (text.includes("crew") || text.includes("equipment")) {
    return "hold_for_crew_or_equipment";
  }

  if (text.includes("work package")) {
    return "hold_for_work_packages";
  }

  if (text.includes("quality") || text.includes("test")) {
    return "hold_for_quality_requirements";
  }

  if (blockers.length > 0) {
    return "blocked";
  }

  return "approve_field_start";
}
