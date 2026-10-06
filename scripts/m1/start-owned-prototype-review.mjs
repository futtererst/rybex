import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { boundary } from "./implementation-context.mjs";
import { clients } from "./baseline-correction/fixtures.mjs";

// Starts only the Next.js review app. The fixture loader verifies the already
// running owned local Supabase stack and keeps its synthetic keys in memory.
boundary();
const port = process.argv[2] ?? "61431";
if (port !== "61430" && port !== "61431") throw new Error("unapproved_review_port");
const { env } = await clients();
if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:61421"
  || env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928") throw new Error("wrong_review_target");
env.M1_PROOF_ENABLED = "1";
env.D5O_REVIEW_PORT = port;
const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", port], {
  cwd: process.cwd(), env, stdio: "inherit", windowsHide: true
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
