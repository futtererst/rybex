import "server-only";

import { notFound } from "next/navigation";

/** Exact, local Discover scratch boundary; does not relax the M1 recovery guard. */
export function assertDiscoverTrialEnvironment() {
  if (process.env.D5O_DISCOVER_TRIAL_ENABLED !== "1"
    || process.env.D5O_DISCOVER_TRIAL_DATABASE !== "d5o_discover_http_20260930_e"
    || process.env.RYBEXOS_RUNTIME_MODE !== "test"
    || process.env.RYBEXOS_AUTH_MODE !== "supabase"
    || process.env.RYBEXOS_DATA_SOURCE !== "database"
    || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:61540"
    || process.env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928") {
    notFound();
  }
}
