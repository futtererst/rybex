import type { RybexPermission } from "../rbac";

export type RybexCommandEnvelope = {
  commandId: string;
  commandType: string;
  entityType: string;
  entityId: string;
  expectedVersion: number;
  correlationId?: string;
};

export type RybexCommandResult<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  success: boolean;
  replayed?: boolean;
  error?: string;
  entityId?: string;
  version?: number;
  payload?: TPayload;
};

export type RybexCommandDefinition = {
  commandType: string;
  entityType: string;
  permission: RybexPermission;
};
