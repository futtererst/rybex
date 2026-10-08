const DEFAULT_AUTH_REDIRECT = "/command-center";

// The isolated M1 proof server is a reviewer-only surface.  A reviewer who
// signs in without a supplied proof URL must never be dropped into preserved
// legacy work surfaces merely because that is the normal application default.
function defaultAuthRedirect() {
  if (process.env.D5O_HOSTED_ENABLED === "1") return "/work";
  return process.env.M1_PROOF_ENABLED === "1" && process.env.RYBEXOS_RUNTIME_MODE === "test"
    ? "/m1-proof"
    : DEFAULT_AUTH_REDIRECT;
}

export function safeInternalRedirectPath(candidate: FormDataEntryValue | string | null | undefined) {
  const raw = typeof candidate === "string" ? candidate.trim() : "";

  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return defaultAuthRedirect();
  }

  try {
    const parsed = new URL(raw, "http://rybex.local");
    if (parsed.origin !== "http://rybex.local") return defaultAuthRedirect();
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || defaultAuthRedirect();
  } catch {
    return defaultAuthRedirect();
  }
}
