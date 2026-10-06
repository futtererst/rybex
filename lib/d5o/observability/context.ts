import "server-only";

export type ObservabilityContext = {
  correlationId: string;
  commandId?: string;
  actorId?: string;
  workspaceId?: string;
  route?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
};

export function createCorrelationId(prefix = "rybex") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
