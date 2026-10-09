import { getSupabaseUrl } from "./supabase-server";

const hostedProjectRef = "fcawktdjoxvahhgvkebx";

export function hostedD5OTargetReady() {
  if (process.env.D5O_HOSTED_ENABLED !== "1") return false;
  try {
    const url = new URL(getSupabaseUrl());
    if (process.env.D5O_ISOLATED_PILOT === "1") {
      const expected = process.env.D5O_ISOLATED_PILOT_URL ?? "http://127.0.0.1:56321";
      const isolated = new URL(expected);
      return process.env.NODE_ENV === "development" &&
        isolated.protocol === "http:" && isolated.hostname === "127.0.0.1" &&
        ["56321", "56621"].includes(isolated.port) && url.origin === isolated.origin;
    }
    return process.env.RYBEXOS_RUNTIME_MODE === "production"
      && url.hostname === `${hostedProjectRef}.supabase.co`;
  }
  catch { return false; }
}
