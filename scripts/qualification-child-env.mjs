import { resolve } from "node:path";
import { QUALIFICATION_PROJECT_PREFIX, PRESERVED_DB_PORT, PRESERVED_PROJECT_ID } from "./cfg-runtime-03-qualification-runtime.mjs";

export function requireQualificationChildEnv(env = process.env, root = process.cwd()) {
  const projectId = env.RYBEX_QUALIFICATION_PROJECT_ID ?? "";
  const projectDir = env.RYBEX_QUALIFICATION_PROJECT_DIR ?? "";
  const dbContainer = env.RYBEX_QUALIFICATION_DB_CONTAINER ?? "";
  if (!projectId.startsWith(QUALIFICATION_PROJECT_PREFIX) || projectId === PRESERVED_PROJECT_ID) throw new Error("disposable_qualification_identity_required");
  if (!projectDir || resolve(projectDir) === resolve(root)) throw new Error("disposable_qualification_directory_required");
  if (!dbContainer.includes(projectId) || dbContainer.includes(PRESERVED_PROJECT_ID)) throw new Error("disposable_qualification_database_container_required");
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"];
  for (const key of required) if (!env[key]) throw new Error(`qualification_child_env_missing:${key}`);
  for (const [key, value] of Object.entries(env)) {
    if (/DATABASE_URL|DB_URL|SUPABASE_URL/i.test(key) && String(value ?? "").includes(`:${PRESERVED_DB_PORT}`)) throw new Error(`preserved_stack_url_rejected:${key}`);
  }
  return Object.fromEntries(required.map((key) => [key, env[key]]));
}
