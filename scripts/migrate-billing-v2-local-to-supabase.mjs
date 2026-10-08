import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClients } from "./foundation-0b-test-utils.mjs";

const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
const storePathArg = process.argv.find((arg) => arg.startsWith("--store="));
const storePath = storePathArg
  ? resolve(process.cwd(), storePathArg.slice("--store=".length))
  : resolve(process.cwd(), ".rybexos-local", "billing-v2-store.json");

if (!["local", "test"].includes(process.env.RYBEXOS_RUNTIME_MODE ?? "local")) {
  throw new Error("Billing V2 local-to-Supabase migration may run only in local/test runtime.");
}

if (!existsSync(storePath)) {
  console.log(JSON.stringify({
    mode,
    status: "no_local_store",
    storePath,
    message: "No Billing V2 local JSON store exists at the requested path."
  }, null, 2));
  process.exit(0);
}

const store = JSON.parse(readFileSync(storePath, "utf8"));
const packages = Object.values(store.packages ?? {});
const packageIds = packages.map((entry) => entry.id);

if (mode === "dry-run") {
  console.log(JSON.stringify({
    mode,
    status: "ready",
    storePath,
    packageCount: packages.length,
    packageIds,
    nextStep: "Re-run with --apply in an explicit local/test runtime after reviewing this dry run."
  }, null, 2));
  process.exit(0);
}

const { service } = createClients();
const { data, error } = await service.rpc("billing_v2_seed_fixture_v1", { p_reset: true });

if (error || data?.success !== true) {
  throw new Error(`Billing V2 Supabase fixture initialization failed: ${error?.message ?? JSON.stringify(data)}`);
}

console.log(JSON.stringify({
  mode,
  status: "applied_reference_fixture",
  storePath,
  packageCount: packages.length,
  packageIds,
  note: "Foundation 0C applies the canonical Billing V2 reference package. Full historical local JSON event migration remains a 0C hardening follow-up before production cutover."
}, null, 2));
