import "server-only";

import { getRequestContext, requireRequestContext } from "./request-context";

export async function getActiveWorkspaceContext() {
  const context = await getRequestContext();

  return {
    status: context.status,
    message: context.message,
    workspace: context.workspace,
    membership: context.membership,
    role: context.role,
    permissions: context.permissions
  };
}

export async function requireActiveWorkspaceContext() {
  const context = await requireRequestContext();

  if (!context.workspace || !context.membership) {
    throw new Error("Active workspace context is required.");
  }

  return context;
}
