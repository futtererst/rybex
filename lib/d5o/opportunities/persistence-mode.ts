import { getRuntimeMode } from "@/lib/d5o/security/runtime-mode";

export function getOpportunityPersistenceMode() {
  if (getRuntimeMode() === "production") {
    return "contained" as const;
  }

  return "database" as const;
}
