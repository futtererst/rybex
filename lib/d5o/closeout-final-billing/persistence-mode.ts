import "server-only";

import { getRuntimeMode, productionLocalAdapterError } from "../security/runtime-mode";

export type CloseoutFinalBillingPersistenceMode = "local" | "database";

export function getCloseoutFinalBillingPersistenceMode(): CloseoutFinalBillingPersistenceMode {
  const configured = process.env.RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE;

  if (configured === "database" || configured === "local") {
    return configured;
  }

  if (getRuntimeMode() === "production") {
    throw new Error("Production Closeout Final Billing requires RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE=database.");
  }

  return "local";
}

export function assertCloseoutFinalBillingDatabasePersistence() {
  if (getCloseoutFinalBillingPersistenceMode() !== "database") {
    throw new Error("Closeout Final Billing database persistence is not enabled for this runtime.");
  }
}

export function assertCloseoutFinalBillingLocalPersistenceAllowed() {
  if (getRuntimeMode() === "production" && getCloseoutFinalBillingPersistenceMode() !== "database") {
    throw new Error(productionLocalAdapterError("Closeout Final Billing"));
  }
}
