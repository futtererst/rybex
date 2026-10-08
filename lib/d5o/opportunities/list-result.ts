export type ScopedListRowsResult =
  | { success: true; rows: Record<string, unknown>[] }
  | { success: false; error: "unavailable" };

// An empty successful list is distinct from a failed or malformed query.
export function parseScopedListRows(response: { data: unknown; error: unknown }): ScopedListRowsResult {
  if (response.error || !response.data || typeof response.data !== "object") {
    return { success: false, error: "unavailable" };
  }
  const data = response.data as Record<string, unknown>;
  if (data.success !== true || !Array.isArray(data.items) ||
      !data.items.every((row) => row !== null && typeof row === "object" && !Array.isArray(row))) {
    return { success: false, error: "unavailable" };
  }
  return { success: true, rows: data.items as Record<string, unknown>[] };
}
