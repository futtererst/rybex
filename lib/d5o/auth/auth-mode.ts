export type RybexAuthMode = "demo" | "supabase";

const allowedAuthModes: RybexAuthMode[] = ["demo", "supabase"];

export function getAuthMode(): RybexAuthMode {
  const configuredMode = process.env.RYBEXOS_AUTH_MODE;

  if (configuredMode && allowedAuthModes.includes(configuredMode as RybexAuthMode)) {
    return configuredMode as RybexAuthMode;
  }

  if (process.env.RYBEXOS_RUNTIME_MODE === "production") {
    return "supabase";
  }

  return "demo";
}

export function isDemoAuthMode() {
  return getAuthMode() === "demo";
}

export function isSupabaseAuthMode() {
  return getAuthMode() === "supabase";
}
