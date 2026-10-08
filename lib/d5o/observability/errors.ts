import "server-only";

export type RybexErrorCode =
  | "auth_required"
  | "workspace_required"
  | "permission_denied"
  | "persistence_unavailable"
  | "scanner_unavailable"
  | "evidence_rejected"
  | "concurrency_conflict"
  | "idempotency_mismatch"
  | "projection_failed"
  | "unknown";

export class RybexOperationalError extends Error {
  constructor(
    readonly code: RybexErrorCode,
    message: string
  ) {
    super(message);
  }
}
