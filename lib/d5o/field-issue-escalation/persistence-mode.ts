import "server-only";

import { getRuntimeMode, productionLocalAdapterError } from "../security/runtime-mode";

export type FieldIssuePersistenceMode = "local" | "database";

export function getFieldIssuePersistenceMode(): FieldIssuePersistenceMode {
  const configured = process.env.RYBEXOS_FIELD_ISSUE_PERSISTENCE;

  if (configured === "database" || configured === "local") {
    return configured;
  }

  if (getRuntimeMode() === "production") {
    throw new Error("Production Field Issue Escalation requires RYBEXOS_FIELD_ISSUE_PERSISTENCE=database.");
  }

  return "local";
}

export function assertFieldIssueDatabasePersistence() {
  if (getFieldIssuePersistenceMode() !== "database") {
    throw new Error("Field Issue database persistence is not enabled for this runtime.");
  }
}

export function assertFieldIssueLocalPersistenceAllowed() {
  if (getRuntimeMode() === "production" && getFieldIssuePersistenceMode() !== "database") {
    throw new Error(productionLocalAdapterError("Field Issue Escalation"));
  }
}
