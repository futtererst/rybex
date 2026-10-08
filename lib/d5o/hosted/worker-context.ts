import "server-only";
import { createRybexSupabaseAdminClient, createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { hostedD5OTargetReady } from "@/lib/d5o/auth/hosted-target";
import { HostedStateError, type HostedStateKey, type HostedStateResult } from "./prototype-context";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

export async function hostedWorkerContext(workspace: string) {
  if (!hostedD5OTargetReady()) throw new HostedStateError("hosted_unavailable", 503);
  const session = await createRybexSupabaseServerClient();
  const { data: userData, error } = await session.auth.getUser();
  if (error || !userData.user) throw new HostedStateError("unauthenticated", 401);
  const sessionCall = session.rpc.bind(session) as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  const actorResult = await sessionCall("d5o_hosted_actor_v1", { p_workspace_key: workspace });
  const identity = actorResult.data as { role?: string; membershipId?: string } | null;
  if (actorResult.error || identity?.role !== "field_worker" || !identity.membershipId)
    throw new HostedStateError("workspace_forbidden", 403);
  const admin = createRybexSupabaseAdminClient();
  const call = admin.rpc.bind(admin) as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  const binding = await call("d5o_hosted_worker_binding_v1", {
    p_workspace_key: workspace, p_actor_user_id: userData.user.id
  });
  const person = (binding.data as { person?: string } | null)?.person;
  if (binding.error || !person) throw new HostedStateError("worker_binding_missing", 403);
  return {
    actor: { id: userData.user.id, name: person, role: "field_worker", membershipId: identity.membershipId, person },
    person,
    async read(key: HostedStateKey): Promise<HostedStateResult> {
      const result = await call("d5o_hosted_server_read_v1", { p_workspace_key: workspace, p_state_key: key });
      if (result.error || !result.data) throw new HostedStateError("state_unavailable", 503);
      return result.data as HostedStateResult;
    },
    async save(key: "work" | "schedule", revision: number, state: Record<string, unknown>): Promise<HostedStateResult> {
      const result = await call("d5o_hosted_server_worker_save_v1", {
        p_workspace_key: workspace, p_state_key: key, p_expected_revision: revision,
        p_state: state, p_actor_user_id: userData.user.id, p_membership_id: identity.membershipId
      });
      if (result.error) throw new HostedStateError(result.error.code === "23505" ? "stale_state" : "state_unavailable", result.error.code === "23505" ? 409 : 503);
      return result.data as HostedStateResult;
    },
    admin
  };
}
