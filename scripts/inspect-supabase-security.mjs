import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const failures = [];

if (!supabaseUrl) {
  failures.push("Set NEXT_PUBLIC_SUPABASE_URL.");
}

if (!secretKey) {
  failures.push("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY for server-side security inspection.");
}

if (failures.length > 0) {
  console.error("Supabase security inspection cannot run:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
const storageUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1`;
const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  "Content-Type": "application/json"
};

const scaffoldStatus = await callRpc("security_scaffold_status").catch((error) => ({
  error: error instanceof Error ? error.message : "security_scaffold_status RPC failed"
}));
const bucketStatus = await inspectBucket("rybexos-evidence");

console.log("Supabase security inspection completed.");
console.log("RLS scaffold status:");
console.log(JSON.stringify(scaffoldStatus, null, 2));
console.log("Storage bucket status:");
console.log(JSON.stringify(bucketStatus, null, 2));

if ("error" in scaffoldStatus) {
  console.error("Security scaffold RPC is missing or failed. Apply supabase/migrations/0004_rls_security_scaffold.sql before relying on DB inspection.");
  process.exit(1);
}

if (!bucketStatus.exists) {
  console.error("rybexos-evidence bucket was not found. Apply supabase/storage/rybexos-evidence-bucket.sql or create the private bucket in Supabase Dashboard.");
  process.exit(1);
}

if (bucketStatus.public === true) {
  console.error("rybexos-evidence bucket is public. It must remain private.");
  process.exit(1);
}

console.log("Supabase security inspection passed: scaffold RPC responded and evidence bucket is private.");

async function callRpc(functionName) {
  const response = await fetch(`${restUrl}/rpc/${functionName}`, {
    method: "POST",
    headers,
    body: "{}",
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`RPC ${functionName} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
  }

  return response.json();
}

async function inspectBucket(bucketName) {
  const response = await fetch(`${storageUrl}/bucket/${bucketName}`, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      exists: false,
      status: response.status,
      statusText: response.statusText
    };
  }

  const body = await response.json();

  return {
    exists: true,
    id: body.id,
    name: body.name,
    public: Boolean(body.public),
    fileSizeLimit: body.file_size_limit ?? body.fileSizeLimit,
    allowedMimeTypes: body.allowed_mime_types ?? body.allowedMimeTypes ?? []
  };
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const source = readFileSync(filePath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}
