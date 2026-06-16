import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const workflows = [
  {
    id: "billing-backup-cash-recovery",
    script: "workflow-completion:qa"
  },
  {
    id: "field-issue-escalation",
    script: "field-issue-completion:qa"
  },
  {
    id: "closeout-requirement-final-billing-release",
    script: "closeout-completion:qa"
  }
];

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
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${script} exited with ${code}`));
      }
    });
    child.on("error", reject);
  });
}

for (const workflow of workflows) {
  console.log(`Running completion QA contract: ${workflow.id}`);
  await run(workflow.script);
}

console.log(`All completion workflow QA contracts passed: ${workflows.map((workflow) => workflow.id).join(", ")}.`);
