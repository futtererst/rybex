import { spawn } from "node:child_process";
import net from "node:net";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nextCommand = process.platform === "win32" ? "node_modules\\.bin\\next.cmd" : "node_modules/.bin/next";
const port = Number(process.env.RYBEX_PILOT_ACCEPTANCE_PORT ?? 3120);
const baseUrl = `http://127.0.0.1:${port}`;

function commandForPlatform(command, args) {
  if (process.platform !== "win32") return { command, args };
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args]
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const platformCommand = commandForPlatform(command, args);
    const child = spawn(platformCommand.command, platformCommand.args, {
      stdio: "inherit",
      shell: false,
      ...options
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
    child.on("error", reject);
  });
}

async function assertPortFree(testPort) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`Pilot acceptance port ${testPort} is already in use.`)));
    server.once("listening", () => {
      server.close(resolve);
    });
    server.listen(testPort, "127.0.0.1");
  });
}

async function waitForServer(url, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Keep waiting for next start to bind.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
    return;
  }
  child.kill("SIGTERM");
}

async function runWithProductionServer(callback) {
  await assertPortFree(port);
  const platformCommand = commandForPlatform(nextCommand, ["start", "-p", String(port)]);
  const server = spawn(platformCommand.command, platformCommand.args, {
    stdio: "inherit",
    shell: false
  });

  try {
    await waitForServer(`${baseUrl}/pilot`);
    await callback();
  } finally {
    await stopProcessTree(server);
  }
}

try {
  await run(npmCommand, ["run", "typecheck"]);
  await run(npmCommand, ["run", "lint"]);
  await run(npmCommand, ["run", "build"]);
  await run(npmCommand, ["audit", "--omit=dev"]);

  await runWithProductionServer(async () => {
    const env = {
      ...process.env,
      BASE_URL: baseUrl,
      RYBEX_VISUAL_BASE_URL: baseUrl
    };

    for (const script of [
      "workflow-state:qa",
      "runtime:qa",
      "workflow-execution:qa",
      "workflow-outcomes:qa",
      "pilot-mode:qa",
      "pilot-progress:qa",
      "pilot-field-closeout:qa",
      "workflow-completion:qa-all",
      "user-flow:qa",
      "cta-outcome:qa"
    ]) {
      await run(npmCommand, ["run", script], { env });
    }
  });

  for (const script of ["pilot-billing-task:verify", "task-outcome:verify", "pilot:acceptance-verify"]) {
    await run(npmCommand, ["run", script]);
  }

  await run(npmCommand, ["run", "verify"], {
    env: {
      ...process.env
    }
  });

  console.log("Pilot acceptance passed: controlled Pilot Mode slice is locked and regression-protected.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
