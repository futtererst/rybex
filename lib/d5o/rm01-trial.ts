import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = /^20\d\d-\d\d-\d\d$/;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type RpcResult = { data: unknown; error: { message: string } | null };
export type RmProfile = {
  name: string; grade: string; skills: string[]; certificates: string[];
  homeBase: string; region: string; workingDays: string[];
  workStart: string; workEnd: string; ptoDates: string[];
  employmentType: "W2" | "1099"; active: boolean; linkedUserId: string | null;
};
export type RmResource = { resourceId: string; technicianCode: string;
  revision: number; profile: RmProfile; updatedAt: string };
export type RmListResult = { status: "ok"; items: RmResource[];
  canCreate: boolean; canEdit: boolean } |
  { status: "denied" | "invalid" | "unavailable" };
export type RmSaveResult = { status: "saved"; resourceId: string;
  revision: number; replayed: boolean } |
  { status: "denied" | "conflict" | "invalid" | "unavailable" };

function validProfile(raw: unknown): raw is RmProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const p = raw as RmProfile;
  const short = (v: unknown, min: number, max: number) =>
    typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
  const stringList = (v: unknown, min: number, max: number) =>
    Array.isArray(v) && v.length >= min && v.length <= max
      && v.every(x => short(x, 2, 80));
  return short(p.name, 3, 160) && short(p.grade, 2, 80)
    && short(p.homeBase, 2, 160) && short(p.region, 2, 80)
    && stringList(p.skills, 1, 20) && stringList(p.certificates, 0, 20)
    && Array.isArray(p.workingDays) && p.workingDays.length >= 1
    && p.workingDays.length <= 7 && p.workingDays.every(x => weekdays.includes(x))
    && Array.isArray(p.ptoDates) && p.ptoDates.length <= 100
    && p.ptoDates.every(x => typeof x === "string" && day.test(x))
    && time.test(p.workStart) && time.test(p.workEnd) && p.workStart < p.workEnd
    && ["W2", "1099"].includes(p.employmentType)
    && typeof p.active === "boolean"
    && (p.linkedUserId === null || uuid.test(p.linkedUserId));
}
function validItem(x: unknown): x is RmResource {
  if (!x || typeof x !== "object") return false;
  const r = x as RmResource;
  return uuid.test(r.resourceId) && typeof r.technicianCode === "string"
    && Number.isInteger(r.revision) && r.revision > 0
    && validProfile(r.profile) && typeof r.updatedAt === "string";
}
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
function errorStatus(message: string): RmSaveResult {
  if (/permission_denied|verification_required|forbidden|unauthenticated/.test(message))
    return { status: "denied" };
  if (/conflict|idempotency_mismatch|command_in_progress|not_found/.test(message))
    return { status: "conflict" };
  if (/invalid_rm_|invalid_command/.test(message)) return { status: "invalid" };
  return { status: "unavailable" };
}
export async function listRmProfiles(workspaceId: string): Promise<RmListResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(workspaceId)) return { status: "invalid" };
  if (!await scoped(workspaceId)) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_rm_list_profiles_v1", { p_workspace_id: workspaceId });
    if (error) return /permission_denied|verification_required/.test(error.message)
      ? { status: "denied" } : { status: "unavailable" };
    const result = data as { items?: unknown; canCreate?: unknown; canEdit?: unknown } | null;
    return Array.isArray(result?.items) && result.items.length <= 500
      && result.items.every(validItem) && typeof result.canCreate === "boolean"
      && typeof result.canEdit === "boolean"
      ? { status: "ok", items: result.items, canCreate: result.canCreate,
          canEdit: result.canEdit } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
export async function saveRmProfile(input: { workspaceId: string;
  resourceId: string | null; expectedRevision: number;
  commandId: string; profile: RmProfile }): Promise<RmSaveResult> {
  assertDiscoverTrialEnvironment();
  if (!uuid.test(input.workspaceId) || input.resourceId !== null && !uuid.test(input.resourceId)
    || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0
    || input.commandId.length < 8 || input.commandId.length > 200
    || !validProfile(input.profile)) return { status: "invalid" };
  if (!await scoped(input.workspaceId)) return { status: "denied" };
  try {
    const { data, error } = await rpc("d5o_rm_save_profile_v1", {
      p_workspace_id: input.workspaceId, p_resource_id: input.resourceId,
      p_expected_revision: input.expectedRevision,
      p_command_id: input.commandId, p_profile: input.profile });
    if (error) return errorStatus(error.message);
    const row = data as { success?: unknown; resourceId?: unknown; revision?: unknown;
      auditId?: unknown; eventId?: unknown; replayed?: unknown } | null;
    return row?.success === true && typeof row.resourceId === "string"
      && uuid.test(row.resourceId) && Number.isInteger(row.revision)
      && typeof row.revision === "number" && row.revision > 0
      && typeof row.auditId === "string" && uuid.test(row.auditId)
      && typeof row.eventId === "string" && uuid.test(row.eventId)
      ? { status: "saved", resourceId: row.resourceId, revision: row.revision,
          replayed: row.replayed === true } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
