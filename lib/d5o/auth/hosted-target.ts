import { getSupabaseUrl } from "./supabase-server";

const hostedProjectRef = "fcawktdjoxvahhgvkebx";

export function hostedD5OTargetReady() {
  if (process.env.D5O_HOSTED_ENABLED !== "1") return false;
  try {
    const url = new URL(getSupabaseUrl());
    if (process.env.D5O_ISOLATED_PILOT === "1")
      return process.env.NODE_ENV === "development" && url.origin === "http://127.0.0.1:56321";
    return process.env.RYBEXOS_RUNTIME_MODE === "production"
      && url.hostname === `${hostedProjectRef}.supabase.co`;
  }
  catch { return false; }
}
