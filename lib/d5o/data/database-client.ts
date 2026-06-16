import { getDataSourceMode } from "./data-source";

export type DatabaseClientPlaceholder = {
  mode: "database";
  supabaseUrl: string;
  restUrl: string;
  publishableKey?: string;
  publishableKeySource?: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  secretKey?: string;
  secretKeySource?: "SUPABASE_SECRET_KEY" | "SUPABASE_SERVICE_ROLE_KEY";
};

export function getDatabaseClient(): DatabaseClientPlaceholder | null {
  if (getDataSourceMode() === "seed") {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : "",
    !publishableKey && !secretKey ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY" : ""
  ].filter(Boolean);

  if (missing.length > 0 || !supabaseUrl) {
    throw new Error(
      `Database mode requested but Supabase env is incomplete: ${missing.join(", ")}. Keep RYBEXOS_DATA_SOURCE=seed or configure a reviewed local read-only pilot environment.`
    );
  }

  return {
    mode: "database",
    supabaseUrl,
    restUrl: `${supabaseUrl.replace(/\/$/, "")}/rest/v1`,
    publishableKey,
    publishableKeySource: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        : undefined,
    secretKey,
    secretKeySource: process.env.SUPABASE_SECRET_KEY
      ? "SUPABASE_SECRET_KEY"
      : process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "SUPABASE_SERVICE_ROLE_KEY"
        : undefined
  };
}

export function requireDatabaseClient(): DatabaseClientPlaceholder {
  const client = getDatabaseClient();

  if (!client) {
    throw new Error("Database client is not enabled while RYBEXOS_DATA_SOURCE is seed.");
  }

  return client;
}

export async function readSupabaseTable<T>(
  tableName: string,
  options: {
    select?: string;
    limit?: number;
    order?: string;
    filters?: Record<string, string>;
  } = {}
): Promise<T[]> {
  const client = requireDatabaseClient();
  const readKey = client.publishableKey ?? client.secretKey;

  if (!readKey) {
    throw new Error("Database mode requested but no Supabase read key is configured.");
  }

  const url = new URL(`${client.restUrl}/${tableName}`);
  url.searchParams.set("select", options.select ?? "*");

  if (typeof options.limit === "number") {
    url.searchParams.set("limit", String(options.limit));
  }

  if (options.order) {
    url.searchParams.set("order", options.order);
  }

  for (const [key, value] of Object.entries(options.filters ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      apikey: readKey,
      Authorization: `Bearer ${readKey}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed for ${tableName}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T[]>;
}

export async function insertSupabaseRow<T>(
  tableName: string,
  payload: Record<string, unknown>
): Promise<T> {
  const rows = await writeSupabaseRows<T>(tableName, payload, "POST");
  const [row] = rows;

  if (!row) {
    throw new Error(`Supabase insert for ${tableName} did not return a row.`);
  }

  return row;
}

export async function uploadSupabaseStorageObject({
  bucket,
  storagePath,
  file,
  contentType
}: {
  bucket: string;
  storagePath: string;
  file: File;
  contentType?: string;
}): Promise<{ bucket: string; storagePath: string; key?: string }> {
  const client = requireDatabaseClient();
  const writeKey = client.secretKey;

  if (!writeKey) {
    throw new Error("Evidence upload pilot requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY on the server.");
  }

  const cleanPath = storagePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  const url = `${client.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${cleanPath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: writeKey,
      Authorization: `Bearer ${writeKey}`,
      "Content-Type": contentType || file.type || "application/octet-stream",
      "x-upsert": "false"
    },
    body: file,
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  const body = await response.json().catch(() => ({}));

  return {
    bucket,
    storagePath,
    key: typeof body.Key === "string" ? body.Key : typeof body.key === "string" ? body.key : undefined
  };
}

export async function updateSupabaseRows<T>(
  tableName: string,
  filters: Record<string, string>,
  payload: Record<string, unknown>
): Promise<T[]> {
  return writeSupabaseRows<T>(tableName, payload, "PATCH", filters);
}

async function writeSupabaseRows<T>(
  tableName: string,
  payload: Record<string, unknown>,
  method: "POST" | "PATCH",
  filters: Record<string, string> = {}
): Promise<T[]> {
  const client = requireDatabaseClient();
  const writeKey = client.secretKey;

  if (!writeKey) {
    throw new Error("Database transaction store is enabled, but server-side Supabase secret is missing. Switch to local transaction store or configure SUPABASE_SECRET_KEY.");
  }

  const url = new URL(`${client.restUrl}/${tableName}`);

  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method,
    headers: {
      apikey: writeKey,
      Authorization: `Bearer ${writeKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase ${method} failed for ${tableName}: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  return response.json() as Promise<T[]>;
}
