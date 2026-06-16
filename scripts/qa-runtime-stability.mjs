import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(process.cwd(), "visual-qa-output/runtime-stability");
const reportPath = join(artifactDir, "runtime-stability-report.json");

const routes = [
  "/command-center",
  "/pilot",
  "/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task",
  "/field-execution?focus=field-issue-escalation&pilot=1#focused-task",
  "/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task",
  "/changes",
  "/closeout"
];

const failPatterns = [
  /hydration failed/i,
  /hydration mismatch/i,
  /text content did not match/i,
  /text did not match/i,
  /did not match/i,
  /duplicate key/i,
  /unique "key"/i,
  /encountered a script tag/i,
  /scripts inside react components/i,
  /getSnapshot should be cached/i,
  /maximum update depth exceeded/i,
  /PilotProgressSummary/i,
  /uncaught/i
];

const seededCompletionState = {
  updatesByItemId: {
    "billing-billing-backup-cash-recovery": {
      id: "billing-billing-backup-cash-recovery",
      status: "evidence_attached",
      resolutionState: "needs_action",
      updatedAt: "2026-06-10T12:00:00.000Z"
    }
  },
  historyByItemId: {
    "billing-billing-backup-cash-recovery": [
      {
        id: "runtime-billing-history",
        itemId: "billing-billing-backup-cash-recovery",
        actionType: "save_backup_note",
        label: "Save backup note",
        actor: "Runtime QA",
        actorRole: "Demo",
        note: "Runtime stability preload.",
        createdAt: "2026-06-10T12:00:00.000Z"
      }
    ],
    "field-issue-escalation": [
      {
        id: "runtime-field-history",
        itemId: "field-issue-escalation",
        actionType: "save_escalation_note",
        label: "Save escalation note",
        actor: "Runtime QA",
        actorRole: "Demo",
        note: "Runtime stability preload.",
        createdAt: "2026-06-10T12:00:00.000Z"
      }
    ],
    "closeout-requirement-final-billing-release": [
      {
        id: "runtime-closeout-history",
        itemId: "closeout-requirement-final-billing-release",
        actionType: "save_closeout_evidence_note",
        label: "Save closeout evidence note",
        actor: "Runtime QA",
        actorRole: "Demo",
        note: "Runtime stability preload.",
        createdAt: "2026-06-10T12:00:00.000Z"
      }
    ]
  },
  notesByItemId: {},
  savedFieldsByItemId: {
    "billing-billing-backup-cash-recovery": {
      backup_note: "Runtime stability preload."
    }
  }
};

async function assertServerReady() {
  try {
    const response = await fetch(`${baseUrl}/command-center`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status >= 200 && response.status < 500) return;
    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run runtime:qa. ${error instanceof Error ? error.message : ""}`);
  }
}

function classifyIssue(route, source, message) {
  const matched = failPatterns.find((pattern) => pattern.test(message));
  if (!matched) return null;
  return {
    route,
    source,
    message
  };
}

mkdirSync(artifactDir, { recursive: true });
await assertServerReady();

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await context.addInitScript((state) => {
  window.localStorage.setItem("rybexos.workflow-completion-demo-state.v1", JSON.stringify(state));
}, seededCompletionState);

const routeReports = [];
const failures = [];

try {
  for (const route of routes) {
    const page = await context.newPage();
    const routeIssues = [];

    page.on("console", (message) => {
      if (!["warning", "error"].includes(message.type())) return;
      const issue = classifyIssue(route, `console:${message.type()}`, message.text());
      if (issue) routeIssues.push(issue);
    });

    page.on("pageerror", (error) => {
      routeIssues.push({
        route,
        source: "pageerror",
        message: error.message
      });
    });

    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(1500);

    routeReports.push({
      route,
      issueCount: routeIssues.length,
      issues: routeIssues
    });
    failures.push(...routeIssues);
    await page.close();
  }
} finally {
  await browser.close();
}

writeFileSync(reportPath, `${JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), routes: routeReports }, null, 2)}\n`);

if (failures.length > 0) {
  console.error("Runtime stability QA failed:");
  for (const failure of failures) {
    console.error(`- ${failure.route} [${failure.source}] ${failure.message}`);
  }
  console.error(`Report written to ${reportPath}`);
  process.exit(1);
}

console.log(`Runtime stability QA passed for ${routes.length} route(s). Report written to ${reportPath}.`);
