import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertCfgRuntime03PreStatusBoundary,
  createSanitizedChildEnv,
  defaultSupabaseCommand,
  runSupabaseStatusWithCfgRuntime03Guard,
} from "./cfg-runtime-03-loopback-guard.mjs";
import {
  ensureLoopbackNetwork,
  inspectSupabaseProjectBindings,
  loopbackNetworkName,
} from "./local-supabase-loopback-network.mjs";

const root = resolve(process.cwd());
const projectId = "rybex-2-local";
const command = defaultSupabaseCommand(root);
const action = process.argv[2] ?? "inspect";

if (action === "start") {
  assertCfgRuntime03PreStatusBoundary({ root, expectedRoot: root, supabaseCommand: command });
  const network = ensureLoopbackNetwork(projectId);
  try {
    const result = runLocalCli(["start", "--network-id", network, "--yes"]);
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Guarded local stack start failed.");
    }
    runSupabaseStatusWithCfgRuntime03Guard({ root, supabaseCommand: command });
    const bindings = inspectSupabaseProjectBindings(projectId);
    process.stdout.write(`${JSON.stringify({ action, network, bindings }, null, 2)}\n`);
  } catch (error) {
    const cleanup = runLocalCli(["stop"], true);
    const cleanupDetail = cleanup.status === 0
      ? "The unsafe or incomplete launch was stopped while preserving named volumes."
      : `Automatic cleanup failed: ${cleanup.stderr || cleanup.stdout}`;
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${cleanupDetail}`);
  }
} else if (action === "inspect") {
  const network = loopbackNetworkName(projectId);
  const status = runSupabaseStatusWithCfgRuntime03Guard({ root, supabaseCommand: command });
  const bindings = inspectSupabaseProjectBindings(projectId);
  const advertised = Object.fromEntries(
    Object.entries(status.parsed).filter(([key]) => /(?:_URL|URL)$/.test(key)),
  );
  process.stdout.write(`${JSON.stringify({ action, network, advertised, bindings }, null, 2)}\n`);
} else if (action === "stop") {
  assertCfgRuntime03PreStatusBoundary({ root, expectedRoot: root, supabaseCommand: command });
  const result = runLocalCli(["stop"], true);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Guarded local stack stop failed.");
  process.stdout.write(result.stdout);
} else {
  throw new Error(`Unsupported local-stack action: ${action}`);
}

function runLocalCli(args, allowFailure = false) {
  const useAdapter = args[0] === "start";
  const childCommand = useAdapter ? process.execPath : "cmd.exe";
  const childArgs = useAdapter ? [resolve(root, "scripts", "run-supabase-loopback.mjs"), ...args] : ["/d", "/s", "/c", command, ...args];
  const result = spawnSync(childCommand, childArgs, {
    cwd: root,
    env: createSanitizedChildEnv(),
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 30,
  });
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
}
