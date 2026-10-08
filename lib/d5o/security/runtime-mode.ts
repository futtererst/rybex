import "server-only";

export type RybexRuntimeMode = "local" | "test" | "production";

const allowedRuntimeModes: RybexRuntimeMode[] = ["local", "test", "production"];

export type ProductionRuntimeCheck = {
  ok: boolean;
  mode: RybexRuntimeMode;
  message: string;
  missing: string[];
};

export function getRuntimeMode(): RybexRuntimeMode {
  const configuredMode = process.env.RYBEXOS_RUNTIME_MODE;

  if (configuredMode && allowedRuntimeModes.includes(configuredMode as RybexRuntimeMode)) {
    return configuredMode as RybexRuntimeMode;
  }

  return "local";
}

export function isLocalRuntime() {
  return getRuntimeMode() === "local";
}

export function isTestRuntime() {
  return getRuntimeMode() === "test";
}

export function isProductionRuntime() {
  return getRuntimeMode() === "production";
}

export function assertLocalOrTestRuntime(action: string) {
  if (isProductionRuntime()) {
    throw new Error(`${action} is not available in production runtime.`);
  }
}

export function getProductionRuntimeReadiness(): ProductionRuntimeCheck {
  const missing = [
    process.env.RYBEXOS_AUTH_MODE !== "supabase" ? "RYBEXOS_AUTH_MODE=supabase" : "",
    process.env.RYBEXOS_DATA_SOURCE !== "database" ? "RYBEXOS_DATA_SOURCE=database" : "",
    !process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : "",
    !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      : ""
  ].filter(Boolean);

  return {
    ok: getRuntimeMode() !== "production" || missing.length === 0,
    mode: getRuntimeMode(),
    message: missing.length === 0
      ? "Production runtime configuration is present."
      : `Production runtime is missing: ${missing.join(", ")}.`,
    missing
  };
}

export function assertProductionRuntimeReady() {
  const readiness = getProductionRuntimeReadiness();

  if (!readiness.ok) {
    throw new Error(readiness.message);
  }

  return readiness;
}

export function productionLocalAdapterError(domain: string) {
  return `${domain} has not passed its production persistence gate. Production runtime refuses seed/local business persistence.`;
}
