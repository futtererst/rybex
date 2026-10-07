const localScheduleOrigins = new Set(["http://127.0.0.1:61430", "http://127.0.0.1:61431"]);

/** Check the browser-visible host, not Next's internally reconstructed request URL. */
export function validLocalScheduleOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("host");
  if (!origin || !host || headers.get("sec-fetch-site") !== "same-origin") return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.host !== host) return false;
    if (process.env.RYBEXOS_RUNTIME_MODE === "production") return parsed.protocol === "https:";
    return localScheduleOrigins.has(origin);
  } catch { return false; }
}
