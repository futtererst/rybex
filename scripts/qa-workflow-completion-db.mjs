import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function commandForPlatform(command, args) {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args]
  };
}

function run(script) {
  return new Promise((resolve, reject) => {
    const platformCommand = commandForPlatform(npmCommand, ["run", script]);
    const child = spawn(platformCommand.command, platformCommand.args, {
      shell: false,
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with ${code}`));
    });
    child.on("error", reject);
  });
}

console.log("Running database workflow completion QA pilot. Current scope: Billing Backup completion event persistence.");
await run("workflow-completion:verify-db");
console.log("Database workflow completion QA pilot passed for the billing completion proof path.");
