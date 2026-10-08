import { spawn } from "node:child_process";
import { clients } from "./m1/baseline-correction/fixtures.mjs";

const context = await clients();
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "61430"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...context.env,
      M1_PROOF_ENABLED: "1",
      RYBEXOS_RUNTIME_MODE: "test",
      RYBEXOS_AUTH_MODE: "supabase",
      RYBEXOS_DATA_SOURCE: "database",
      RYBEX_QUALIFICATION_PROJECT_ID: "rybex-cfg03-q-m1-s1-recovery-20260928",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_ENV: "production"
    },
    stdio: "inherit",
    windowsHide: true
  }
);

server.once("exit", (code) => process.exit(code ?? 1));
