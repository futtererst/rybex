import { lifecycleProfiles, transitionsAt } from "./lifecycle-profiles";
import { evaluateDecisionGuard, type WorkTypeConfiguration } from "./phase-configuration";
import type { WorkRecord } from "./work-types";

type ConditionWork = WorkRecord & {
  issues?: Array<{ id: string; title: string; status: string }>;
  evidence?: Array<{ kind: string; state: string; packageId?: string }>;
  packages?: Array<{ id: string; installed: number; tested: number; accepted: number; status: string }>;
  lifecycle?: Array<{ action: string; owner: string }>;
  heldFrom?: string;
  prototypeDecisionRights?: string[];
};
type TransitionPolicy = { clearBlockers?: boolean; acceptedPackages?: boolean; reviewedEvidenceKind?: string; commercialConfidence?: string };
export const transitionPolicies: Record<ConditionWork["workspace"], Record<string, TransitionPolicy>> = {
  rybex: { "Quality verification": { clearBlockers: true, acceptedPackages: true }, "Customer acceptance": { reviewedEvidenceKind: "Acceptance record" } },
  rotork: { "Pilot review": { reviewedEvidenceKind: "Proof package" }, "Commercial readiness": { commercialConfidence: "Committed" } }
};

export function currentPrototypeTransition(item: ConditionWork) {
  if (!item.phaseConfigurationVersionId || item.type !== lifecycleProfiles[item.workspace].workType) return null;
  return transitionsAt(item.workspace, item.stage).filter((transition) => transition.type !== "exception").find((transition) => !(item.prototypeDecisionRights ?? []).includes(transition.right)) ?? null;
}

export function transitionBlockers(item: ConditionWork, config?: WorkTypeConfiguration | null): string[] {
  const policy = transitionPolicies[item.workspace][item.stage];
  const failures: string[] = [];
  if (item.phaseConfigurationVersionId) {
    if (!config) failures.push("The pinned phase configuration is unavailable; restore its exact version before deciding.");
    else if (config.decisionGuards?.length) {
      const transition = currentPrototypeTransition(item);
      if (!transition && item.status !== "complete") failures.push("No configured decision transition is available for this Work Record position.");
      else if (transition && !config.decisionGuards.some((guard) => guard.stage === item.stage && guard.right === transition.right)) failures.push("The pinned configuration has no check binding for this decision.");
      else if (transition) failures.push(...evaluateDecisionGuard(item, config, item.stage, transition.right).map((check) => check.message));
    }
  }
  if (item.stage === "Held for resolution") {
    if (!item.heldFrom) return ["This historical hold has no prior-stage context; restore or reconcile it before resuming."];
    const heldIssue = item.issues?.find((entry) => entry.status === "open" && entry.id.startsWith("i-held-"));
    return heldIssue ? [`Held condition remains open: ${heldIssue.title}`] : [];
  }
  const openIssue = item.issues?.find((entry) => entry.status === "open");
  if (openIssue) failures.push(`Controlled issue remains open: ${openIssue.title}`);
  if (!policy) return failures;
  if (policy.clearBlockers && item.blockers.length) failures.push(item.blockers[0]);
  if (policy.acceptedPackages && (item.packages ?? []).some((entry) => entry.status !== "accepted")) failures.push("All controlled packages require recorded acceptance.");
  if (policy.reviewedEvidenceKind && !(item.evidence ?? []).some((entry) => entry.kind === policy.reviewedEvidenceKind && entry.state !== "draft" && (policy.reviewedEvidenceKind !== "Acceptance record" || !entry.packageId))) failures.push(`A reviewed ${policy.reviewedEvidenceKind.toLowerCase()} is required.`);
  if (policy.commercialConfidence && item.commercial?.confidence !== policy.commercialConfidence) failures.push(`Commercial confidence must be ${policy.commercialConfidence.toLowerCase()}.`);
  return failures;
}

export function operationalCondition(item: ConditionWork, config?: WorkTypeConfiguration | null) {
  const blockers = transitionBlockers(item, config);
  return { blockers, status: item.status === "complete" ? "complete" as const : item.status === "attention" || blockers.length ? "attention" as const : "moving" as const };
}
