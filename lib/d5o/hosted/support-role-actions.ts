import type { WorkRecord } from "@/components/d5o/platform/work-types";
import { currentWorkAcceptanceScope } from "@/components/d5o/platform/deploy-model";

export type SupportAction = {
  kind: "receive-handoff" | "add-asset" | "accept-support" | "activate";
  workId: string; title: string; customer: string; decisionId: string;
  decisionRevision: number; sourceRevision: number; deployRevision: number;
  position: "available" | "preparation" | "waiting";
  responsibleRole: string; blocker: string | null;
};

/** Read-only routing. The authenticated typed command owns every decision. */
export function supportRoleActions(records: WorkRecord[], actorId: string, role: string): SupportAction[] {
  if (!["project_manager", "operations_leader"].includes(role)) return [];
  const actions: SupportAction[] = [];
  for (const work of records) {
    if (!work.canonicalWorkId || !work.deploy?.workAcceptance || !currentWorkAcceptanceScope(work)) continue;
    const receipt = work.deploy.workAcceptance, state = work.operate;
    if (receipt.receipt !== "Accepted") continue;
    const base = { workId: work.id, title: work.title, customer: work.customer,
      decisionId: receipt.id, decisionRevision: receipt.revision,
      sourceRevision: state?.authorityRevision ?? 0, deployRevision: work.deploy.authorityRevision ?? 0 };
    const add = (kind: SupportAction["kind"], responsibleRole: string, eligible: boolean, blocker: string | null = null) =>
      actions.push({ ...base, kind, responsibleRole, blocker,
        position: blocker ? eligible ? "preparation" : "waiting" : eligible ? "available" : "waiting" });
    if (!state?.source) add("receive-handoff", "Operations leader who accepted the exact delivery receipt",
      role === "operations_leader" && receipt.receivedByActorId === actorId);
    else if (!state.assets.length) add("add-asset", "Project manager or Operations leader", true,
      "Identify at least one supported asset or infrastructure system from the accepted scope.");
    else if (!state.support) add("accept-support", "Operations leader", role === "operations_leader",
      "Review contact, escalation, intake, coverage dispositions, documents and residual obligations.");
    else if (!state.activation) add("activate", "Operations leader", role === "operations_leader",
      "Review operational readiness and resolve any outstanding prerequisites before authorization.");
  }
  return actions;
}
