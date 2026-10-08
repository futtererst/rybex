import "server-only";

import { getRuntimeMode, productionLocalAdapterError } from "../security/runtime-mode";

export type BillingV2PersistenceMode = "local" | "database";

export function getBillingV2PersistenceMode(): BillingV2PersistenceMode {
  const configured = process.env.RYBEXOS_BILLING_V2_PERSISTENCE;

  if (configured === "database" || configured === "local") {
    return configured;
  }

  if (getRuntimeMode() === "production") {
    throw new Error("Production Billing V2 requires RYBEXOS_BILLING_V2_PERSISTENCE=database.");
  }

  return "local";
}

export function assertBillingV2DatabasePersistence() {
  if (getBillingV2PersistenceMode() !== "database") {
    throw new Error("Billing V2 database persistence is not enabled for this runtime.");
  }
}

export function assertBillingV2LocalPersistenceAllowed() {
  if (getRuntimeMode() === "production" && getBillingV2PersistenceMode() !== "database") {
    throw new Error(productionLocalAdapterError("Billing V2"));
  }
}
