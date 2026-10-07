import "server-only";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { hostedD5OTargetReady } from "@/lib/d5o/auth/hosted-target";

export type HostedStateKey = "work" | "catalog" | "schedule";
export type HostedRpcError = { code?: string; message: string };
export type HostedStateResult = { revision: number; state: Record<string, unknown> | null };
type RpcName = "d5o_hosted_actor_v1" | "d5o_hosted_prototype_read_v1" |
  "d5o_hosted_prototype_save_v1";
type RpcResult = { data: unknown; error: HostedRpcError | null };

const editors = new Set(["admin", "operations_leader", "project_manager", "field_supervisor"]);

export class HostedStateError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

function rpcError(error: HostedRpcError | null): HostedStateError {
  if (error?.code === "42501") return new HostedStateError("workspace_forbidden", 403);
  if (error?.code === "23505") return new HostedStateError("stale_state", 409);
  if (error?.code === "22023") return new HostedStateError("invalid_state", 422);
  return new HostedStateError("state_unavailable", 503);
}

export async function hostedPrototypeContext(workspace: string) {
  if (!hostedD5OTargetReady()) throw new HostedStateError("hosted_unavailable", 503);
  const client = await createRybexSupabaseServerClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new HostedStateError("unauthenticated", 401);
  const call = client.rpc.bind(client) as unknown as
    (name: RpcName, args: Record<string, unknown>) => Promise<RpcResult>;
  const actor = await call("d5o_hosted_actor_v1", { p_workspace_key: workspace });
  if (actor.error || !actor.data || typeof actor.data !== "object")
    throw new HostedStateError("workspace_forbidden", 403);
  const identity = actor.data as { role?: string; membershipId?: string };
  const role = identity.role ?? "";
  const actorName = userData.user.user_metadata?.display_name;
  return {
    actor: { id: userData.user.id,
      name: typeof actorName === "string" && actorName.trim() ? actorName.trim() : userData.user.email ?? "Workspace member",
      role, membershipId: identity.membershipId ?? "" },
    canEdit: editors.has(role),
    async read(key: HostedStateKey): Promise<HostedStateResult> {
      const result = await call("d5o_hosted_prototype_read_v1", {
        p_workspace_key: workspace, p_state_key: key
      });
      if (result.error) throw rpcError(result.error);
      const read = result.data as HostedStateResult | null;
      if (!read || !Number.isInteger(read.revision)) throw new HostedStateError("invalid_response", 502);
      return read;
    },
    async save(key: HostedStateKey, revision: number, state: Record<string, unknown>): Promise<HostedStateResult> {
      if (!editors.has(role)) throw new HostedStateError("workspace_forbidden", 403);
      const result = await call("d5o_hosted_prototype_save_v1", {
        p_workspace_key: workspace, p_state_key: key,
        p_expected_revision: revision, p_state: state
      });
      if (result.error) throw rpcError(result.error);
      const saved = result.data as HostedStateResult | null;
      if (!saved || !Number.isInteger(saved.revision) || !saved.state)
        throw new HostedStateError("invalid_response", 502);
      return saved;
    }
  };
}
