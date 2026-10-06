import "server-only";

import type { ObservabilityContext } from "./context";

type LogLevel = "info" | "warn" | "error";

export type StructuredLogEntry = ObservabilityContext & {
  level: LogLevel;
  event: string;
  durationMs?: number;
  success?: boolean;
  errorCode?: string;
  message?: string;
};

export function logOperationalEvent(entry: StructuredLogEntry) {
  const redacted = redactEntry(entry);
  const line = JSON.stringify({
    ...redacted,
    timestamp: new Date().toISOString(),
    system: "rybexos"
  });

  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export async function withOperationalLogging<T>(entry: Omit<StructuredLogEntry, "level" | "success" | "durationMs">, fn: () => Promise<T>) {
  const started = Date.now();

  try {
    const result = await fn();
    logOperationalEvent({
      ...entry,
      level: "info",
      success: true,
      durationMs: Date.now() - started
    });
    return result;
  } catch (error) {
    logOperationalEvent({
      ...entry,
      level: "error",
      success: false,
      durationMs: Date.now() - started,
      errorCode: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "Unknown operational error."
    });
    throw error;
  }
}

function redactEntry(entry: StructuredLogEntry): StructuredLogEntry {
  const copy = { ...entry };
  for (const key of Object.keys(copy) as Array<keyof StructuredLogEntry>) {
    const value = copy[key];
    if (typeof value === "string") {
      copy[key] = redact(value) as never;
    }
  }
  return copy;
}

function redact(value: string) {
  return value
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]")
    .replace(/https?:\/\/[^/\s]+\/storage\/v1\/object\/sign\/[^\s]+/g, "[REDACTED_SIGNED_URL]");
}
