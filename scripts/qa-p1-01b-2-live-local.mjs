import { existsSync } from "node:fs";

const remoteUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(remoteUrl);

const scenarios = [
  "A Authorized pursuit enters Bid Submission / Pursuit Outcome",
  "B Submission preparation",
  "C Mark package ready",
  "D Hold submission approval",
  "E Approve submission",
  "F Record submission",
  "G Clarification requested",
  "H Revision / BAFO requested",
  "I Revised submission / BAFO submitted",
  "J Lost / not selected",
  "K Withdrawn / no-submit",
  "L Selected / intent-to-award handoff",
  "M Auditor/read-only",
  "N Unavailable / ineligible",
  "O Cross-workspace isolation",
  "P Stale/conflict",
  "Q Action failure/recovery",
  "R Mobile smoke"
];

const result = {
  localSupabaseUrl: remoteUrl || "not configured",
  safeLocalSupabase: isLocal,
  scenarios: scenarios.map((scenario) => ({
    scenario,
    status: isLocal ? "Blocked" : "Blocked",
    notes: isLocal
      ? "Live browser QA harness placeholder created; seeded scenario execution must be completed against local Supabase before human acceptance."
      : "Environment is not confirmed local Supabase. Remote or missing Supabase settings were not used."
  }))
};

const artifactDir = "artifacts/p1-01b-2-implementation-acceptance-review/live-browser-qa";
if (!existsSync(artifactDir)) {
  console.log(JSON.stringify(result, null, 2));
  console.error("Live local QA blocked: artifact folder is not initialized by a live seeded run.");
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
console.error("Live local QA blocked: live seeded scenario execution is not complete.");
process.exit(1);
