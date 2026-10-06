import "server-only";

import { requireRequestContext } from "../auth/request-context";
import { createRybexSupabaseServerClient } from "../auth/supabase-server";
import type { RybexCommandResult } from "./types";

type UpdateWorkspaceDisplayNameInput = {
  commandId: string;
  expectedVersion: number;
  displayName: string;
  correlationId?: string;
};

type RpcResult = RybexCommandResult<{
  name?: string;
}>;

type UntypedRpc = (functionName: string, args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

export async function updateWorkspaceDisplayNameReferenceCommand(input: UpdateWorkspaceDisplayNameInput): Promise<RpcResult> {
  await requireRequestContext("workspace.manage");

  const supabase = await createRybexSupabaseServerClient();
  const rpc = supabase.rpc as unknown as UntypedRpc;
  const result = await rpc("update_workspace_display_name_v1", {
    p_command_id: input.commandId,
    p_expected_version: input.expectedVersion,
    p_new_display_name: input.displayName,
    p_correlation_id: input.correlationId ?? null
  });

  if (result.error) {
    return {
      success: false,
      error: result.error.message
    };
  }

  return result.data as RpcResult;
}
