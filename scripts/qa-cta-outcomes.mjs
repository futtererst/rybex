import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const artifactDir = resolve(root, "visual-qa-output/cta-outcome-qa");
const reportPath = resolve(root, "docs/cta-outcome-clarity-qa-report.md");
const backlogPath = resolve(root, "docs/cta-outcome-remediation-backlog.md");
const resultsPath = join(artifactDir, "results.json");
const progressPath = join(artifactDir, "progress.txt");

const routes = [
  { route: "/command-center", focus: "Command Center" },
  { route: "/billing", focus: "Billing cash blocker" },
  { route: "/closeout", focus: "Closeout acceptance blocker" },
  { route: "/field-execution", focus: "Daily report / field escalation" },
  { route: "/changes", focus: "Change recovery protection" },
  { route: "/rfis-submittals", focus: "Information-control blocker" },
  { route: "/pipeline", focus: "Pipeline go/no-go" },
  { route: "/projects", focus: "Project baseline clearance" },
  { route: "/mobilization", focus: "Mobilization field-start blocker" },
  { route: "/safety", focus: "Safety action closure" },
  { route: "/quality", focus: "Quality deficiency / test blocker" },
  { route: "/reports", focus: "Optimize learning loop" },
  { route: "/admin", focus: "Admin readiness review" }
];

const bannedVagueLabels = [
  /^open priority$/i,
  /^open action details$/i,
  /^review details$/i,
  /^open workflow$/i,
  /^learn more$/i
];

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function markProgress(message) {
  try {
    writeFileSync(progressPath, `${new Date().toISOString()} ${message}\n`, { flag: "a" });
  } catch {
    // Best-effort diagnostic for long-running QA.
  }
}

function isBannedVagueLabel(label) {
  return bannedVagueLabels.some((pattern) => pattern.test(label));
}

async function assertServerReady() {
  try {
    const response = await fetch(`${baseUrl}/command-center`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status >= 200 && response.status < 500) return;
    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run cta-outcome:qa. ${error instanceof Error ? error.message : ""}`);
  }
}

async function visibleCount(page, selector) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.filter((node) => {
      const element = node;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    }).length
  ).catch(() => 0);
}

async function collectOutcomeCandidates(page) {
  return page.locator("main a, main button").evaluateAll((nodes) => {
    const wanted = [];

    for (const [index, node] of nodes.entries()) {
      const element = node;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const label = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") ?? "" : "";
      const visible = style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;

      if (!visible || !label) continue;
      if (element instanceof HTMLButtonElement && element.disabled) continue;

      const area = element.closest(".action-cockpit")
        ? "cockpit"
        : element.closest(".page-header")
          ? "header"
          : element.closest("#details-records")
            ? "details"
            : "body";

      const isImportant =
        element.classList.contains("action-cockpit-cta") ||
        /open details/i.test(label) ||
        /^new /i.test(label) ||
        /^review /i.test(label) ||
        /^view /i.test(label) ||
        /commercial exposure|acceptance risks|production rates|open workflow|review d[1-5]|apply learning|clear|protect|unblock/i.test(label);

      if (!isImportant) continue;

      wanted.push({
        area,
        href,
        index,
        label,
        primary: element.classList.contains("action-cockpit-cta")
      });
    }

    const rank = { cockpit: 0, header: 1, body: 2, details: 3 };
    return wanted.sort((a, b) => rank[a.area] - rank[b.area]);
  });
}

function scoreOutcome(result) {
  if (result.vagueLabel || result.genericRouteOnly || result.sectionOnlyHighlight || result.missingFocusedTask || result.missingInstruction) return 1;
  if (result.modalOpened) return 5;
  if (result.focusedTaskPanel && result.hasTaskInstruction) return 5;
  if (result.pathChanged) return 5;
  if (result.detailsExpanded && result.highlightVisible) return 5;
  if (result.hashChanged && result.highlightVisible) return 5;
  if (result.detailsExpanded || result.pageScrolled || result.highlightVisible) return 4;
  if (result.hashChanged) return 3;
  if (result.successOrDemoMessage) return 4;
  return 2;
}

function notesFor(result) {
  if (result.vagueLabel) return "CTA label is too vague to describe the task outcome.";
  if (result.genericRouteOnly) return "Routes to a module page without focus metadata or task instruction.";
  if (result.sectionOnlyHighlight) return "Only highlights a generic details section, not an exact task.";
  if (result.missingFocusedTask) return "Focus metadata is present but no focused task panel appeared.";
  if (result.missingInstruction) return "Focused task panel appeared without a visible 'You are here to' instruction.";
  if (result.focusedTaskPanel && result.hasTaskInstruction) return "Opens a focused task panel with clear next-step instructions.";
  if (result.pathChanged) return "Routes to a different relevant page.";
  if (result.modalOpened) return "Opens a modal/dialog with a clear action surface.";
  if (result.detailsExpanded && result.highlightVisible) return "Expands details and highlights the target section.";
  if (result.hashChanged && result.highlightVisible) return "Focuses and highlights the target section.";
  if (result.detailsExpanded || result.pageScrolled) return "Moves the user to supporting detail, but highlight clarity should be watched.";
  if (result.successOrDemoMessage) return "Shows visible feedback.";
  return "Outcome is technically reachable but lacks a clear visible cue.";
}

async function clickAndAssess(page, route, candidate) {
  console.log(`Assessing ${route}: ${candidate.label}`);
  markProgress(`candidate start ${route} ${candidate.label}`);
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "commit", timeout: 5000 });
  } catch (error) {
    return {
      ...candidate,
      afterUrl: page.url(),
      beforeUrl: `${baseUrl}${route}`,
      clarityScore: 1,
      label: candidate.label,
      notes: error instanceof Error ? error.message : "Route load failed before CTA assessment.",
      pass: false
    };
  }
  markProgress(`candidate loaded ${route} ${candidate.label}`);
  await page.waitForLoadState("domcontentloaded", { timeout: 500 }).catch(() => undefined);
  await page.waitForTimeout(120);

  if (candidate.area === "details") {
    await page.locator("#details-records details").evaluateAll((details) => {
      for (const detail of details) detail.open = true;
    }).catch(() => undefined);
  }

  const beforeUrl = page.url();
  const beforeParsed = new URL(beforeUrl);
  const beforeOpenDetails = await visibleCount(page, "details[open]");
  const beforeDialog = await visibleCount(page, "[role='dialog'], dialog, .modal, .workflow-transaction-modal");
  const beforeScroll = await page.evaluate(() => window.scrollY);
  const locator = candidate.primary
    ? page.locator(".action-cockpit .action-cockpit-cta").first()
    : /open details/i.test(candidate.label)
      ? page.locator(".action-cockpit-footer a").filter({ hasText: /open details/i }).first()
      : page.locator("main a, main button").nth(candidate.index);
  const label = normalize(await locator.innerText().catch(() => candidate.label));

  try {
    await locator.click({ timeout: 3000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 1500 }).catch(() => undefined);
    await page.waitForFunction(
      (previousUrl) => window.location.href !== previousUrl || Boolean(document.querySelector('[data-qa="focused-task-panel"]')),
      beforeUrl,
      { timeout: candidate.primary ? 2500 : 800 }
    ).catch(() => undefined);
    await page.waitForTimeout(250);
    if (page.url().includes("focus=") || page.url().includes("#focused-task")) {
      await page.waitForSelector('[data-qa="focused-task-panel"]', { timeout: 1800 }).catch(() => undefined);
    }
  } catch (error) {
    markProgress(`candidate click failed ${route} ${candidate.label}`);
    return {
      ...candidate,
      afterUrl: page.url(),
      beforeUrl,
      clarityScore: 1,
      label,
      notes: error instanceof Error ? error.message : "CTA click failed.",
      pass: false
    };
  }
  markProgress(`candidate assessed ${route} ${candidate.label}`);

  const afterUrl = page.url();
  const afterParsed = new URL(afterUrl);
  const afterOpenDetails = await visibleCount(page, "details[open]");
  const afterDialog = await visibleCount(page, "[role='dialog'], dialog, .modal, .workflow-transaction-modal");
  const afterScroll = await page.evaluate(() => window.scrollY);
  const highlightVisible = (await visibleCount(page, ".cta-focus-highlight")) > 0 ||
    (afterParsed.hash ? await visibleCount(page, afterParsed.hash) > 0 : false);
  const successOrDemoMessage = (await visibleCount(page, ".transaction-message, .form-error, [role='status'], .workflow-outcome-banner, .notification-card")) > 0;
  const focusedTaskPanel = await visibleCount(page, '[data-qa="focused-task-panel"]');
  const focusedTaskText = await page.locator('[data-qa="focused-task-panel"]').first().innerText({ timeout: 200 }).catch(() => "");
  const hasTaskInstruction = /you are here to/i.test(focusedTaskText);
  const hasFocusMetadata = afterParsed.searchParams.has("focus") || afterParsed.hash === "#focused-task";
  const genericRouteOnly = candidate.primary && beforeParsed.pathname !== afterParsed.pathname && !hasFocusMetadata;
  const sectionOnlyHighlight = candidate.primary && afterParsed.hash === "#details-records" && focusedTaskPanel === 0;
  const missingFocusedTask = candidate.primary && hasFocusMetadata && focusedTaskPanel === 0;
  const missingInstruction = focusedTaskPanel > 0 && !hasTaskInstruction;
  const vagueLabel = isBannedVagueLabel(label);

  const result = {
    ...candidate,
    afterUrl,
    beforeUrl,
    detailsExpanded: afterOpenDetails > beforeOpenDetails,
    hashChanged: beforeParsed.hash !== afterParsed.hash && afterParsed.hash.length > 0,
    highlightVisible,
    label,
    modalOpened: afterDialog > beforeDialog,
    pageScrolled: Math.abs(afterScroll - beforeScroll) > 20,
    pathChanged: beforeParsed.pathname !== afterParsed.pathname,
    focusedTaskPanel: focusedTaskPanel > 0,
    hasTaskInstruction,
    vagueLabel,
    genericRouteOnly,
    sectionOnlyHighlight,
    missingFocusedTask,
    missingInstruction,
    successOrDemoMessage,
    urlChanged: beforeUrl !== afterUrl
  };

  const clarityScore = scoreOutcome(result);

  return {
    ...result,
    clarityScore,
    notes: notesFor(result),
    pass: clarityScore >= 4
  };
}

function writeDocs(results) {
  const lines = [
    "# CTA Outcome Clarity QA Report",
    "",
    `Generated against \`${baseUrl}\`.`,
    "",
    "A CTA passes when the user can clearly see the outcome: route change, modal/drawer, expanded details, highlighted/focused section, transaction feedback, or clear unavailable/demo messaging.",
    "",
    "## Manual Founder Review Failures",
    "",
    "- Observed behavior: Command Center `Open priority` routed to `/projects` without a task instruction.",
    "- Observed behavior: Pipeline `Open action details` highlighted the Pipeline Details bar without an exact object or next step.",
    "- Why it failed: both outcomes worked mechanically but left the user guessing.",
    "- Fix implemented: cockpit CTAs now use concrete labels, focus metadata, and a focused task panel with `You are here to` and `Do next` instructions.",
    "- Verification: this QA fails vague labels, generic route-only outcomes, generic section-only highlights, and missing focused task panels.",
    ""
  ];

  for (const routeInfo of routes) {
    const routeResults = results.filter((result) => result.route === routeInfo.route);
    const failed = routeResults.filter((result) => !result.pass);

    lines.push(`## ${routeInfo.focus}`);
    lines.push("");
    lines.push(`- Route: \`${routeInfo.route}\``);
    lines.push(`- Tested CTAs: ${routeResults.length}`);
    lines.push(`- Outcome clarity: ${failed.length === 0 ? "Pass" : "Needs remediation"}`);
    lines.push(`- Confusing outcomes: ${failed.length}`);
    lines.push("");
    lines.push("| CTA | Area | Primary | Score | Pass/fail | Outcome observed |");
    lines.push("| --- | --- | --- | --- | --- | --- |");

    for (const result of routeResults) {
      lines.push(`| ${result.label} | ${result.area} | ${result.primary ? "yes" : "no"} | ${result.clarityScore}/5 | ${result.pass ? "Pass" : "Fail"} | ${result.notes} |`);
    }

    if (routeResults.length === 0) {
      lines.push("| No important CTAs detected | - | - | 1/5 | Fail | Page needs a primary outcome path. |");
    }

    lines.push("");
    lines.push(`Recommended fix: ${failed.length === 0 ? "No safe fix required by automated outcome QA." : "See CTA outcome remediation backlog."}`);
    lines.push("");
  }

  const failures = results.filter((result) => !result.pass);
  const backlog = [
    "# CTA Outcome Remediation Backlog",
    "",
    "## Manual Founder Review Failures",
    "",
    "| Observed behavior | Why it failed | Fix implemented | Verification | Status |",
    "| --- | --- | --- | --- | --- |",
    "| Command Center `Open priority` routed generically to `/projects` | User did not know which Projects task needed attention | Concrete task labels and focus metadata now route to a focused task panel | Primary cockpit QA requires focus metadata and `You are here to` | Completed |",
    "| Pipeline `Open action details` only highlighted the Pipeline Details bar | The user saw a generic section, not an action outcome | Same-page cockpit CTAs now focus the exact task panel | QA fails primary CTAs that only target `#details-records` | Completed |",
    "",
    "## Must Fix Before Founder Review",
    "",
    "| Page | CTA | Current outcome | Why it is unclear | Recommended fix | Priority | Status |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  ];

  const must = failures.filter((result) => result.primary || result.area === "cockpit" || result.area === "header");
  if (must.length === 0) {
    backlog.push("| All priority routes | No unresolved primary/header CTA clarity failures detected | Outcomes route, focus, expand, highlight, or show feedback | No founder-review blocker found | Keep outcome QA in the demo gate | P0 | Completed |");
  } else {
    for (const item of must) {
      backlog.push(`| ${item.route} | ${item.label} | ${item.notes} | User may not know what happened after clicking | Add highlight/focus, route to a specific existing flow, or show clear feedback | P0 | Open |`);
    }
  }

  backlog.push("");
  backlog.push("## Should Fix Before Executive Demo");
  backlog.push("");
  backlog.push("| Page | CTA | Current outcome | Why it is unclear | Recommended fix | Priority | Status |");
  backlog.push("| --- | --- | --- | --- | --- | --- | --- |");

  const should = failures.filter((result) => !(result.primary || result.area === "cockpit" || result.area === "header"));
  if (should.length === 0) {
    backlog.push("| Details sections | No unresolved secondary clarity failures detected by automated QA | Secondary CTAs produced visible outcomes | Low risk | Continue manual review for deep record actions | P1 | Completed |");
  } else {
    for (const item of should) {
      backlog.push(`| ${item.route} | ${item.label} | ${item.notes} | Detail user may lose context | Add a section highlight, clearer label, or local feedback | P1 | Open |`);
    }
  }

  backlog.push("");
  backlog.push("## Later");
  backlog.push("");
  backlog.push("| Page | CTA | Current outcome | Why it is unclear | Recommended fix | Priority | Status |");
  backlog.push("| --- | --- | --- | --- | --- | --- | --- |");
  backlog.push("| All pages | Deep record actions | Many detailed records remain demo/read-only | Full record drawers need persistence/auth maturity | Add record-level drawers after production data contracts mature | P2 | Deferred |");

  writeFileSync(reportPath, `${lines.join("\n")}\n`);
  writeFileSync(backlogPath, `${backlog.join("\n")}\n`);
}

await assertServerReady();
mkdirSync(artifactDir, { recursive: true });
writeFileSync(progressPath, "");
markProgress("server ready");

const browser = await chromium.launch();
markProgress("browser launched");
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
markProgress("page opened");
const results = [];

try {
  for (const routeInfo of routes) {
    markProgress(`route ${routeInfo.route}`);
    try {
      await page.goto(`${baseUrl}${routeInfo.route}`, { waitUntil: "commit", timeout: 12000 });
    } catch (error) {
      results.push({
        route: routeInfo.route,
        routeFocus: routeInfo.focus,
        area: "route",
        href: "",
        index: -1,
        label: "Route load",
        primary: false,
        afterUrl: page.url(),
        beforeUrl: `${baseUrl}${routeInfo.route}`,
        clarityScore: 1,
        notes: error instanceof Error ? error.message : "Route load failed during CTA outcome QA.",
        pass: false
      });
      continue;
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 500 }).catch(() => undefined);
    await page.waitForTimeout(150);

    const candidates = await collectOutcomeCandidates(page);
    const primary = candidates.find((candidate) => candidate.primary);
    const openDetails = candidates.find((candidate) => /open details/i.test(candidate.label));
    const selected = [];

    for (const candidate of [primary, openDetails].filter(Boolean)) {
      if (!selected.some((item) => item.index === candidate.index)) {
        selected.push(candidate);
      }
    }

    for (const candidate of selected.slice(0, 2)) {
      const result = await clickAndAssess(page, routeInfo.route, candidate);
      results.push({
        ...result,
        route: routeInfo.route,
        routeFocus: routeInfo.focus
      });
    }
  }
} finally {
  await browser.close();
}

writeFileSync(resultsPath, `${JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
writeDocs(results);

const failures = results.filter((result) => !result.pass);
console.log(`CTA outcome QA complete: ${results.length} CTA checks, ${failures.length} clarity issue(s).`);
console.log(`Report written to ${reportPath}`);
console.log(`Backlog written to ${backlogPath}`);
