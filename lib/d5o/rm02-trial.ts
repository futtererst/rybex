import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RpcResult = { data: unknown; error: { message: string } | null };
export type RmJobPayload = {
  jobType: string; scope: string; priority: string; siteAddress: string;
  requiredSkills: string[]; requiredGrades: string[];
  estimatedPersonHours: number; requiredCrewSize: number;
  scheduledStart: string; scheduledEnd: string;
  customerContact: string; notes: string; documentRefs: string[];
};
export type RmJobReadiness = { blockers: string[]; warnings: string[];
  estimatedPersonHours: number; requiredCrewSize: number;
  equalShareHours: number; jobSpanHours: number | null };
export type RmEligibleWork = { workId: string; title: string; accountName: string;
  siteName: string; siteAddress: string | null; accountId: string;
  siteId: string; workVersion: number };
export type RmJob = { workId: string; jobCode: string; accountName: string;
  siteName: string; revision: number; state: "draft" | "ready_for_dispatch";
  payload: RmJobPayload; readiness: RmJobReadiness; updatedAt: string };
export type RmJobList = { status: "ok"; works: RmEligibleWork[]; items: RmJob[];
  jobTypes: { key: string; label: string }[]; priorities: { key: string; label: string }[];
  canSave: boolean } | { status: "denied" | "invalid" | "unavailable" };
export type RmJobSave = { status: "saved"; workId: string; revision: number;
  state: "draft" | "ready_for_dispatch"; readiness: RmJobReadiness;
  replayed: boolean } | { status: "denied" | "conflict" | "invalid" |
  "not_ready" | "handoff_required" | "unavailable" };

async function scoped(workspaceId: string) {
  const context = await getRequestContext();
  return context.authenticated && context.status === "authorized"
    && context.workspace?.id === workspaceId;
}
async function rpc(name: string, args: Record<string, unknown>): Promise<RpcResult> {
  const client = await createRybexSupabaseServerClient();
  return (client.rpc.bind(client) as unknown as
    (name: string, args: Record<string, unknown>) => Promise<RpcResult>)(name, args);
}
function validPayload(p: unknown): p is RmJobPayload {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const x = p as RmJobPayload;
  return [x.jobType,x.scope,x.priority,x.siteAddress,x.scheduledStart,
      x.scheduledEnd,x.customerContact,x.notes].every(y => typeof y === "string")
    && x.scope.length <= 4000 && x.siteAddress.length <= 500
    && x.customerContact.length <= 500 && x.notes.length <= 4000
    && Array.isArray(x.requiredSkills) && x.requiredSkills.length <= 20
    && x.requiredSkills.every(y => typeof y === "string" && y.length <= 80)
    && Array.isArray(x.requiredGrades) && x.requiredGrades.length <= 20
    && x.requiredGrades.every(y => typeof y === "string" && y.length <= 80)
    && Array.isArray(x.documentRefs) && x.documentRefs.length <= 20
    && x.documentRefs.every(y => typeof y === "string" && uuid.test(y))
    && Number.isFinite(x.estimatedPersonHours) && x.estimatedPersonHours >= 0
    && Number.isInteger(x.requiredCrewSize) && x.requiredCrewSize >= 0;
}
function validReadiness(x: unknown): x is RmJobReadiness {
  if (!x || typeof x !== "object") return false;
  const r = x as RmJobReadiness;
  return Array.isArray(r.blockers) && r.blockers.every(y => typeof y === "string")
    && Array.isArray(r.warnings) && r.warnings.every(y => typeof y === "string")
    && typeof r.estimatedPersonHours === "number"
    && typeof r.requiredCrewSize === "number"
    && typeof r.equalShareHours === "number"
    && (r.jobSpanHours === null || typeof r.jobSpanHours === "number");
}
function errorStatus(message: string): RmJobSave {
  if (/rm_job_permission_denied|rm_permission_denied|verification_required|forbidden|unauthenticated/.test(message))
    return { status: "denied" };
  if (/rm_job_conflict|idempotency_mismatch|command_in_progress|rm_job_identity_changed/.test(message))
    return { status: "conflict" };
  if (/rm_handoff_required/.test(message)) return { status: "handoff_required" };
  if (/rm_job_not_ready/.test(message)) return { status: "not_ready" };
  if (/invalid_rm_|rm_site_link_required|rm_work_unavailable|rm_job_document_invalid/.test(message))
    return { status: "invalid" };
  return { status: "unavailable" };
}
export async function listRmJobs(workspaceId: string): Promise<RmJobList> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId)) return { status: "invalid" };
  if (!await scoped(workspaceId)) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_rm_list_jobs_v1", { p_workspace_id: workspaceId });
    if (error) return /permission_denied|verification_required|forbidden/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const r = data as Partial<Extract<RmJobList, { status: "ok" }>> | null;
    if (!r || !Array.isArray(r.works) || r.works.length > 200
      || !r.works.every(w => uuid.test(w.workId) && uuid.test(w.accountId)
        && uuid.test(w.siteId) && typeof w.title === "string"
        && typeof w.accountName === "string" && typeof w.siteName === "string"
        && (w.siteAddress === null || typeof w.siteAddress === "string")
        && Number.isInteger(w.workVersion))
      || !Array.isArray(r.items) || r.items.length > 200
      || !r.items.every(j => uuid.test(j.workId) && typeof j.jobCode === "string"
        && Number.isInteger(j.revision) && validPayload(j.payload)
        && validReadiness(j.readiness)
        && ["draft","ready_for_dispatch"].includes(j.state))
      || !Array.isArray(r.jobTypes) || !Array.isArray(r.priorities)
      || typeof r.canSave !== "boolean") return { status: "unavailable" };
    return { status: "ok", works: r.works, items: r.items,
      jobTypes: r.jobTypes, priorities: r.priorities, canSave: r.canSave };
  } catch { return { status: "unavailable" }; }
}
export async function saveRmJob(input: { workspaceId: string; workId: string;
  expectedRevision: number; commandId: string; mode: "save" | "ready";
  payload: RmJobPayload }): Promise<RmJobSave> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(input.workspaceId) || !uuid.test(input.workId)
    || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0
    || input.commandId.length < 8 || input.commandId.length > 200
    || !["save","ready"].includes(input.mode) || !validPayload(input.payload))
    return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_rm_save_job_v1", {
      p_workspace_id: input.workspaceId,p_work_id: input.workId,
      p_expected_revision: input.expectedRevision,p_command_id: input.commandId,
      p_mode: input.mode,p_payload: input.payload });
    if (error) return errorStatus(error.message);
    const x = data as { success?: unknown; workId?: unknown; revision?: unknown;
      state?: unknown; readiness?: unknown; auditId?: unknown;
      eventId?: unknown; replayed?: unknown } | null;
    return x?.success === true && x.workId === input.workId
      && typeof x.revision === "number" && Number.isInteger(x.revision)
      && x.revision > 0 && ["draft","ready_for_dispatch"].includes(String(x.state))
      && validReadiness(x.readiness) && typeof x.auditId === "string"
      && uuid.test(x.auditId) && typeof x.eventId === "string" && uuid.test(x.eventId)
      ? { status: "saved", workId: input.workId, revision: x.revision,
          state: x.state as "draft" | "ready_for_dispatch",
          readiness: x.readiness, replayed: x.replayed === true }
      : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
