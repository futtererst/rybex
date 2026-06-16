import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const requiredRoutes = [
  "/command-center",
  "/pilot",
  "/pipeline",
  "/pipeline/new",
  "/projects",
  "/projects/new",
  "/mobilization",
  "/mobilization/new",
  "/field-execution",
  "/field-execution/daily-report/new",
  "/rfis-submittals",
  "/rfis-submittals/rfi/new",
  "/rfis-submittals/submittal/new",
  "/changes",
  "/changes/new",
  "/billing",
  "/billing/pay-application/new",
  "/safety",
  "/safety/record/new",
  "/safety/jha/new",
  "/quality",
  "/quality/inspection/new",
  "/quality/deficiency/new",
  "/closeout",
  "/closeout/package/new",
  "/reports",
  "/reports/lessons-learned/new",
  "/admin"
];

const requiredFiles = [
  "README.md",
  ".env.example",
  "app/admin/page.tsx",
  "scripts/smoke-routes.mjs",
  "docs/demo-readiness.md",
  "docs/demo-script.md",
  "docs/demo-click-path.md",
  "docs/demo-cheat-sheet.md",
  "docs/ceo-demo-path.md",
  "docs/visual-qa-checklist.md",
  "docs/ux-simplification-audit.md",
  "docs/ux-simplification-system.md",
  "docs/role-based-usability-audit.md",
  "docs/role-journey-map.md",
  "docs/user-knows-what-to-do-checklist.md",
  "docs/page-simplification-system.md",
  "docs/persistence-architecture.md",
  "docs/database-schema-plan.md",
  "docs/persistence-technology-decision.md",
  "docs/migration-sequence.md",
  "docs/data-repository-contract.md",
  "docs/seed-to-database-mapping.md",
  "docs/schema-risk-review.md",
  "docs/persistence-implementation-checklist.md",
  "docs/schema-coverage-review.md",
  "docs/relationship-model-review.md",
  "docs/status-history-review.md",
  "docs/audit-requirements-review.md",
  "docs/rbac-rls-review.md",
  "docs/attachment-strategy-review.md",
  "docs/reporting-query-review.md",
  "docs/database-local-setup.md",
  "docs/persistence-phase-2-d1-d2.md",
  "docs/persistence-phase-3-workflow-transactions.md",
  "docs/persistence-phase-4-workflow-transaction-writes.md",
  "docs/auth-rbac-foundation.md",
  "docs/rls-storage-security-foundation.md",
  "docs/evidence-attachment-foundation.md",
  "docs/supabase-storage-evidence-pilot.md",
  "docs/notification-escalation-foundation.md",
  "docs/production-readiness-gap-review.md",
  "docs/pilot-readiness-scorecard.md",
  "docs/controlled-pilot-launch-plan.md",
  "docs/pilot-user-test-scripts.md",
  "docs/pilot-risk-register.md",
  "docs/local-supabase-verification.md",
  "docs/route-inventory.md",
  "docs/deployment-readiness.md",
  "docs/stakeholder-demo-package.md",
  "docs/package-export-guide.md",
  "docs/local-visual-qa-runbook.md",
  "docs/visual-qa-report-template.md",
  "scripts/capture-visual-qa.mjs",
  "scripts/verify-workflow-actions.mjs",
  "scripts/verify-workflow-transaction-db.mjs",
  "scripts/verify-evidence-upload-pilot.mjs",
  "scripts/verify-security-foundation.mjs",
  "scripts/verify-pilot-readiness.mjs",
  "scripts/verify-page-simplification.mjs",
  "scripts/inspect-supabase-security.mjs",
  "supabase/migrations/0004_rls_security_scaffold.sql",
  "supabase/storage/rybexos-evidence-bucket.sql"
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    failures.push(`Missing required demo asset: ${file}`);
  }
}

const smokeFile = resolve(root, "scripts/smoke-routes.mjs");
if (existsSync(smokeFile)) {
  const smokeSource = readFileSync(smokeFile, "utf8");
  for (const route of requiredRoutes) {
    if (!smokeSource.includes(`"${route}"`)) {
      failures.push(`Route missing from smoke list: ${route}`);
    }
  }
}

const envExample = resolve(root, ".env.example");
if (existsSync(envExample)) {
  const envSource = readFileSync(envExample, "utf8");
  const requiredEnvLines = [
    "RYBEXOS_DATA_SOURCE=seed",
    "RYBEXOS_WORKFLOW_TRANSACTION_STORE=local",
    "RYBEXOS_EVIDENCE_STORE=local",
    "NEXT_PUBLIC_SUPABASE_URL=",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
    "SUPABASE_SECRET_KEY=",
    "SUPABASE_SERVICE_ROLE_KEY="
  ];

  for (const line of requiredEnvLines) {
    if (!envSource.includes(line)) {
      failures.push(`.env.example missing safe placeholder: ${line}`);
    }
  }
}

const dataSourceFile = resolve(root, "lib/d5o/data/data-source.ts");
if (existsSync(dataSourceFile)) {
  const dataSourceSource = readFileSync(dataSourceFile, "utf8");
  if (!dataSourceSource.includes('return "seed"')) {
    failures.push("Data source helper no longer defaults to seed mode.");
  }
}

const packageJsonFile = resolve(root, "package.json");
if (existsSync(packageJsonFile)) {
  const packageJson = JSON.parse(readFileSync(packageJsonFile, "utf8"));
  for (const scriptName of ["dev", "build", "typecheck", "lint", "smoke:routes", "verify", "demo:check", "demo:package", "visual:capture", "visual:qa", "workflow:verify-actions", "db:verify-workflow-transactions", "evidence:verify-upload", "security:verify", "pilot:verify", "simplify:verify", "db:inspect-security"]) {
    if (!packageJson.scripts?.[scriptName]) {
      failures.push(`package.json missing script: ${scriptName}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Demo readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Demo readiness check passed: ${requiredRoutes.length} routes and ${requiredFiles.length} required assets verified.`);
