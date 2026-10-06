import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createSanitizedChildEnv } from "./cfg-runtime-03-loopback-guard.mjs";

const root = resolve(process.cwd());
const action = process.argv[2];
if (!new Set(["validate", "generate"]).has(action)) throw new Error(`unsupported Prisma action: ${action}`);
const prisma = resolve(root, "node_modules", "prisma", "build", "index.js");
const env = createSanitizedChildEnv();
env.DATABASE_URL = "postgresql://local_validation:local_validation@127.0.0.1:1/local_validation";
const result = spawnSync(process.execPath, [prisma, action], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: false,
});
process.exit(result.status ?? 1);
