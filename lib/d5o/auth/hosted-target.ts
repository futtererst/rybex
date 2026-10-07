import { getSupabaseUrl } from "./supabase-server";

const hostedProjectRef = "fcawktdjoxvahhgvkebx";

export function hostedD5OTargetReady() {
  if (process.env.D5O_HOSTED_ENABLED !== "1" || process.env.RYBEXOS_RUNTIME_MODE !== "production") return false;
  try { return new URL(getSupabaseUrl()).hostname === `${hostedProjectRef}.supabase.co`; }
  catch { return false; }
}
