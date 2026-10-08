import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertCfgRuntime03PreStatusBoundary,
  createSanitizedChildEnv,
  defaultSupabaseCommand,
} from "./cfg-runtime-03-loopback-guard.mjs";
import { assertDisposableQualificationIdentity } from "./cfg-runtime-03-qualification-runtime.mjs";
import { ensureLoopbackNetwork, inspectSupabaseProjectBindings } from "./local-supabase-loopback-network.mjs";

const root = resolve(process.cwd());
const action = process.argv[2];
const projectId = process.env.RYBEX_QUALIFICATION_PROJECT_ID;
const projectDir = process.env.RYBEX_QUALIFICATION_PROJECT_DIR;
const identity = assertDisposableQualificationIdentity({ root, projectId, projectDir, env: process.env });
const command = defaultSupabaseCommand(root);
assertCfgRuntime03PreStatusBoundary({ root, expectedRoot: root, supabaseCommand: command });

if (action !== "start") throw new Error(`unsupported_guarded_qualification_action:${action}`);
const networkName = ensureLoopbackNetwork(identity.projectId);
const result = spawnSync(process.execPath, [
  resolve(root, "scripts", "run-supabase-loopback.mjs"),
  "start",
  "--workdir",
  identity.projectDir,
  "--network-id",
  networkName,
  "--yes",
], {
  cwd: root,
  env: createSanitizedChildEnv({
    RYBEX_QUALIFICATION_PROJECT_ID: identity.projectId,
    RYBEX_QUALIFICATION_PROJECT_DIR: identity.projectDir,
  }),
  encoding: "utf8",
  shell: false,
  maxBuffer: 1024 * 1024 * 100,
});
if (result.status !== 0) throw new Error(result.stderr || result.stdout || "guarded qualification start failed");
const bindings = inspectSupabaseProjectBindings(identity.projectId);
process.stdout.write(`${JSON.stringify({ projectId: identity.projectId, projectDir: identity.projectDir, networkName, bindings }, null, 2)}\n`);
