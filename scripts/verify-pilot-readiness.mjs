import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "docs/production-readiness-gap-review.md",
  "docs/pilot-readiness-scorecard.md",
  "docs/controlled-pilot-launch-plan.md",
  "docs/pilot-user-test-scripts.md",
  "docs/pilot-risk-register.md",
  "lib/d5o/readiness/pilot-readiness.ts",
  "app/admin/page.tsx"
];

const requiredReadinessFunctions = [
  "getPilotReadinessScorecard",
  "getPilotReadinessSummary",
  "getPilotBlockers",
  "getPilotRecommendations"
];

const requiredScorecardAreas = [
  "D5O workflow coverage",
  "UX clarity",
  "Role clarity",
  "Workflow transaction execution",
  "Supabase persistence",
  "Auth/RBAC",
  "Evidence handling",
  "Upload/storage",
  "Notifications/escalations",
  "RLS/security",
  "Reporting/analytics",
  "Admin/system readiness",
  "Integration readiness",
  "Deployment readiness",
  "Operational support readiness"
];

const requiredLimitations = [
  "not production-ready",
  "controlled internal pilot",
  "No external GC/client access",
  "No sensitive production documents",
  "external notifications",
  "RLS",
  "seed/local fallback"
];

const requiredVerificationReferences = [
  "npm run demo:check",
  "npm run typecheck",
  "npm run lint",
  "npm run build",
  "npm audit --omit=dev",
  "npm run smoke:routes",
  "npm run verify",
  "npm run workflow:verify-actions",
  "npm run rbac:verify",
  "npm run evidence:verify",
  "npm run notifications:verify",
  "npm run security:verify"
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    failures.push(`Missing pilot readiness asset: ${file}`);
  }
}

const readinessFile = resolve(root, "lib/d5o/readiness/pilot-readiness.ts");
if (existsSync(readinessFile)) {
  const readinessSource = readFileSync(readinessFile, "utf8");

  for (const functionName of requiredReadinessFunctions) {
    if (!readinessSource.includes(functionName)) {
      failures.push(`Pilot readiness model missing function: ${functionName}`);
    }
  }

  for (const area of requiredScorecardAreas) {
    if (!readinessSource.includes(area)) {
      failures.push(`Pilot readiness scorecard missing area: ${area}`);
    }
  }

  if (readinessSource.includes('rating: "production_ready"')) {
    failures.push("Pilot readiness scorecard must not rate any area production_ready in the current state.");
  }
}

const combinedDocs = [
  "docs/production-readiness-gap-review.md",
  "docs/pilot-readiness-scorecard.md",
  "docs/controlled-pilot-launch-plan.md",
  "docs/pilot-user-test-scripts.md",
  "docs/pilot-risk-register.md"
]
  .filter((file) => existsSync(resolve(root, file)))
  .map((file) => readFileSync(resolve(root, file), "utf8"))
  .join("\n");
const normalizedDocs = combinedDocs.toLowerCase();

for (const phrase of requiredLimitations) {
  if (!normalizedDocs.includes(phrase.toLowerCase())) {
    failures.push(`Pilot readiness docs missing limitation: ${phrase}`);
  }
}

for (const command of requiredVerificationReferences) {
  if (!combinedDocs.includes(command)) {
    failures.push(`Pilot readiness docs missing verification reference: ${command}`);
  }
}

const adminFile = resolve(root, "app/admin/page.tsx");
if (existsSync(adminFile)) {
  const adminSource = readFileSync(adminFile, "utf8");
  const normalizedAdminSource = adminSource.toLowerCase();
  for (const phrase of ["Pilot Readiness", "controlled pilot", "production-readiness-gap-review.md"]) {
    if (!normalizedAdminSource.includes(phrase.toLowerCase())) {
      failures.push(`Admin readiness section missing phrase: ${phrase}`);
    }
  }
}

const packageJsonFile = resolve(root, "package.json");
if (existsSync(packageJsonFile)) {
  const packageJson = JSON.parse(readFileSync(packageJsonFile, "utf8"));
  if (!packageJson.scripts?.["pilot:verify"]) {
    failures.push("package.json missing script: pilot:verify");
  }
}

if (failures.length > 0) {
  console.error("Pilot readiness verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Pilot readiness verification passed.");
