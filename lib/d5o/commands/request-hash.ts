import "server-only";

import { createHash } from "crypto";

export function createStableRequestHash(payload: Record<string, unknown>) {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(objectValue[key])}`)
    .join(",")}}`;
}
