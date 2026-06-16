import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const baseUrl = process.env.BASE_URL ?? process.env.RYBEX_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const reportPath = resolve(root, "docs/user-workflow-qa-report.md");
const backlogPath = resolve(root, "docs/user-workflow-remediation-backlog.md");
const artifactDir = resolve(root, "visual-qa-output/user-workflow-qa");
const resultsPath = join(artifactDir, "results.json");

const scenarios = [
  {
    id: 1,
    name: "Executive priority review",
    route: "/command-center",
    intent: "Identify the top operating priority and act on it.",
    expected: "No CTA should route to /command-center with no state change."
  },
  {
    id: 2,
    name: "Pipeline go/no-go decision",
    route: "/pipeline",
    intent: "Resolve a pursuit decision or intake blocker.",
    expected: "Decision CTA should open or focus a meaningful go/no-go action path."
  },
  {
    id: 3,
    name: "Project baseline clearance",
    route: "/projects",
    intent: "Clear a D2 contract or baseline blocker.",
    expected: "Clear baseline must expose the blocker or route to an existing setup flow."
  },
  {
    id: 4,
    name: "Mobilization field-start blocker",
    route: "/mobilization",
    intent: "Identify what blocks field start and clear or inspect it.",
    expected: "Field-start CTA should open details or a relevant action path."
  },
  {
    id: 5,
    name: "Field execution daily report / issue escalation",
    route: "/field-execution",
    intent: "Submit today’s report or escalate a field issue.",
    expected: "New Daily Report should route to the creation flow; escalation should expose a relevant path."
  },
  {
    id: 6,
    name: "RFI/Submittal blocker",
    route: "/rfis-submittals",
    intent: "Resolve information control blocking field work.",
    expected: "CTAs should route to RFI/submittal creation or focus the register."
  },
  {
    id: 7,
    name: "Change recovery protection",
    route: "/changes",
    intent: "Protect change recovery before notice or backup is missed.",
    expected: "Protect recovery should open a notice, backup, details, or change action path."
  },
  {
    id: 8,
    name: "Billing cash blocker",
    route: "/billing",
    intent: "Clear billing backup or pay application blocker.",
    expected: "Billing CTA should not route back to /billing without focus or detail exposure."
  },
  {
    id: 9,
    name: "Safety action closure",
    route: "/safety",
    intent: "Close or inspect a safety blocker.",
    expected: "Safety CTA should open close/resolve workflow or details."
  },
  {
    id: 10,
    name: "Quality deficiency/test blocker",
    route: "/quality",
    intent: "Close a quality action or test gap.",
    expected: "Quality CTA should resolve, route, or focus the relevant action."
  },
  {
    id: 11,
    name: "Closeout acceptance blocker",
    route: "/closeout",
    intent: "Clear closeout, final billing, or retainage blocker.",
    expected: "Closeout CTA should focus or open requirement details."
  },
  {
    id: 12,
    name: "Optimize learning loop",
    route: "/reports",
    intent: "Act on a lesson learned or production-rate update.",
    expected: "Learning CTA should open or focus improvement actions."
  },
  {
    id: 13,
    name: "Admin readiness review",
    route: "/admin",
    intent: "Understand system status and verify readiness.",
    expected: "Admin CTAs should scroll, focus, open a section, or route to a real reference."
  }
];

const destructivePatterns = [
  /confirm/i,
  /submit final/i,
  /^submit$/i,
  /delete/i,
  /remove/i,
  /archive/i,
  /^approve/i,
  /^hold/i,
  /waive/i,
  /^verify$/i,
  /^upload/i,
  /^send/i,
  /^publish/i,
  /dismiss/i,
  /acknowledge/i,
  /mark in progress/i,
  /^resolve$/i
];

const safePatterns = [
  /open/i,
  /details/i,
  /review/i,
  /^new /i,
  /^view /i,
  /command center/i,
  /pipeline/i,
  /commercial exposure/i,
  /acceptance risks/i,
  /production rates/i,
  /action details/i,
  /go resolve/i,
  /resolve workflow/i,
  /clear /i,
  /protect /i,
  /unblock /i,
  /close .*action/i,
  /apply learning/i
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

function safeLabel(label) {
  if (!label) return false;
  if (destructivePatterns.some((pattern) => pattern.test(label))) return false;
  return safePatterns.some((pattern) => pattern.test(label));
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
    if (response.status >= 200 && response.status < 500) {
      return;
    }
    throw new Error(`Unexpected status ${response.status}`);
  } catch (error) {
    throw new Error(`Local RybexOS server is not reachable at ${baseUrl}. Start the app with npm run dev, then run npm run user-flow:qa. ${error instanceof Error ? error.message : ""}`);
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

async function collectCandidates(page) {
  const candidates = await page.locator("main a, main button").evaluateAll((nodes) =>
    nodes.map((node, index) => {
      const element = node;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
      const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") : "";
      const area = element.closest(".action-cockpit")
        ? "cockpit"
        : element.closest(".page-header")
          ? "header"
          : element.closest("#details-records")
            ? "details"
            : "body";
      return {
        index,
        label: text,
        href,
        tagName: element.tagName.toLowerCase(),
        area,
        primary: element.classList.contains("action-cockpit-cta"),
        inDetails: Boolean(element.closest("#details-records")),
        disabled: element instanceof HTMLButtonElement ? element.disabled : element.getAttribute("aria-disabled") === "true",
        visible: style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0
      };
    })
  );

  return candidates
    .filter((candidate) => candidate.visible && !candidate.disabled && safeLabel(candidate.label))
    .sort((a, b) => {
      const rank = { cockpit: 0, header: 1, details: 2, body: 3 };
      return rank[a.area] - rank[b.area];
    });
}

async function clickCandidate(page, route, candidate) {
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 10000 });
  } catch (error) {
    return {
      ...candidate,
      sourceRoute: route,
      beforeUrl: `${baseUrl}${route}`,
      afterUrl: page.url(),
      urlChanged: false,
      modalOpened: false,
      detailsExpanded: false,
      pageScrolled: false,
      feedbackAppeared: false,
      focusedTaskPanel: false,
      appearsDead: true,
      category: "route-load-failed",
      notes: error instanceof Error ? error.message : "Route load failed before CTA assessment."
    };
  }
  await page.waitForLoadState("domcontentloaded", { timeout: 500 }).catch(() => undefined);
  await page.waitForTimeout(80);

  if (candidate.inDetails) {
    await page.locator("#details-records details").evaluateAll((details) => {
      for (const detail of details) {
        detail.open = true;
      }
    }).catch(() => undefined);
    await page.waitForTimeout(100);
  }

  const beforeUrl = page.url();
  const beforeOpenDetails = await visibleCount(page, "details[open]");
  const beforeDialog = await visibleCount(page, "[role='dialog'], dialog, .modal, .workflow-transaction-modal");
  const beforeScroll = await page.evaluate(() => window.scrollY);

  const locator = page.locator("main a, main button").nth(candidate.index);
  const actualLabel = normalize(await locator.innerText().catch(() => candidate.label));

  try {
    await locator.click({ noWaitAfter: true, timeout: 1800 });
    await waitForExpectedOutcome(page, candidate.href ?? "", beforeUrl);
    await page.waitForLoadState("domcontentloaded", { timeout: 1200 }).catch(() => undefined);
    await page.waitForTimeout(320);
    if (page.url().includes("focus=") || page.url().includes("#focused-task")) {
      await page.waitForSelector('[data-qa="focused-task-panel"]', { timeout: 1800 }).catch(() => undefined);
    }
  } catch (error) {
    return {
      ...candidate,
      label: actualLabel || candidate.label,
      sourceRoute: route,
      beforeUrl,
      afterUrl: page.url(),
      urlChanged: false,
      modalOpened: false,
      detailsExpanded: false,
      pageScrolled: false,
      feedbackAppeared: false,
      appearsDead: true,
      category: "click-failed",
      notes: error instanceof Error ? error.message : "Click failed."
    };
  }

  const afterUrl = page.url();
  const afterOpenDetails = await visibleCount(page, "details[open]");
  const afterDialog = await visibleCount(page, "[role='dialog'], dialog, .modal, .workflow-transaction-modal");
  const afterScroll = await page.evaluate(() => window.scrollY);
  const feedbackAppeared = await visibleCount(page, ".transaction-message, .form-error, [role='status'], .notification-card, .workflow-outcome-banner");
  const focusedTaskPanel = await visibleCount(page, '[data-qa="focused-task-panel"]');
  const focusedTaskInstruction = await page.locator('[data-qa="focused-task-panel"]').first().innerText({ timeout: 200 }).catch(() => "");
  const urlChanged = beforeUrl !== afterUrl;
  const beforeParsed = new URL(beforeUrl);
  const afterParsed = new URL(afterUrl);
  const samePath = beforeParsed.pathname === afterParsed.pathname;
  const hashChanged = beforeParsed.hash !== afterParsed.hash && afterParsed.hash.length > 0;
  const targetIsDetailsOnly = afterParsed.hash === "#details-records";
  const crossPageRoute = beforeParsed.pathname !== afterParsed.pathname;
  const hasFocusMetadata = afterParsed.searchParams.has("focus") || afterParsed.hash === "#focused-task";
  const primaryCockpit = candidate.primary && candidate.area === "cockpit";
  const detailsExpanded = afterOpenDetails > beforeOpenDetails;
  const modalOpened = afterDialog > beforeDialog;
  const pageScrolled = Math.abs(afterScroll - beforeScroll) > 20;
  const meaningful = urlChanged || hashChanged || modalOpened || detailsExpanded || pageScrolled || feedbackAppeared > 0;
  const vagueLabel = isBannedVagueLabel(actualLabel || candidate.label);
  const genericRouteOnly = primaryCockpit && crossPageRoute && !hasFocusMetadata;
  const sectionOnlyHighlight = primaryCockpit && targetIsDetailsOnly && focusedTaskPanel === 0;
  const missingFocusedTask = primaryCockpit && hasFocusMetadata && focusedTaskPanel === 0;
  const missingInstruction = focusedTaskPanel > 0 && !/you are here to/i.test(focusedTaskInstruction);
  const appearsDead = !meaningful ||
    vagueLabel ||
    genericRouteOnly ||
    sectionOnlyHighlight ||
    missingFocusedTask ||
    missingInstruction ||
    (urlChanged && samePath && !hashChanged && !detailsExpanded && !modalOpened && !pageScrolled && feedbackAppeared === 0);
  const failureCategory = vagueLabel
    ? "vague-label"
    : genericRouteOnly
      ? "generic-route-only"
      : sectionOnlyHighlight
        ? "generic-section-highlight"
        : missingFocusedTask
          ? "missing-focused-task-panel"
          : missingInstruction
            ? "missing-next-step-instruction"
            : appearsDead
              ? "dead-or-same-page-no-op"
              : "working";

  return {
    ...candidate,
    label: actualLabel || candidate.label,
    sourceRoute: route,
    beforeUrl,
    afterUrl,
    urlChanged,
    modalOpened,
    detailsExpanded,
    pageScrolled,
    feedbackAppeared: feedbackAppeared > 0,
    focusedTaskPanel: focusedTaskPanel > 0,
    appearsDead,
    category: failureCategory,
    notes: appearsDead
      ? failureCategory === "vague-label"
        ? "CTA label is too vague for a task outcome."
        : failureCategory === "generic-route-only"
          ? "CTA routes to a module page without focus metadata or task instruction."
          : failureCategory === "generic-section-highlight"
            ? "CTA only highlights a generic details section, not a focused task."
            : failureCategory === "missing-focused-task-panel"
              ? "CTA has focus metadata but no focused task panel appeared."
              : failureCategory === "missing-next-step-instruction"
                ? "Focused task panel appeared without a visible 'You are here to' instruction."
                : "No visible navigation, modal, details expansion, scroll/focus, or feedback was detected."
      : "CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome."
  };
}

async function waitForExpectedOutcome(page, href, beforeUrl) {
  if (!href) {
    await page.waitForTimeout(350);
    return;
  }

  if (href.startsWith("#")) {
    await page.waitForFunction((hash) => window.location.hash === hash, href, { timeout: 2500 }).catch(() => undefined);
    return;
  }

  if (href.startsWith("/")) {
    const expected = new URL(href, baseUrl);
    await page.waitForFunction(
      ({ pathname, search, hash, before }) => {
        const matchesPath = window.location.pathname === pathname;
        const matchesSearch = search ? window.location.search === search : true;
        const matchesHash = hash ? window.location.hash === hash : true;
        return window.location.href !== before && matchesPath && matchesSearch && matchesHash;
      },
      {
        pathname: expected.pathname,
        search: expected.search,
        hash: expected.hash,
        before: beforeUrl
      },
      { timeout: 3000 }
    ).catch(() => undefined);
    return;
  }

  await page.waitForTimeout(350);
}

function scenarioStatus(items) {
  return items.some((item) => item.appearsDead) ? "Fail" : "Pass";
}

function recommendationFor(item) {
  if (/details/i.test(item.label)) return "Ensure the CTA expands and focuses the detail section.";
  if (item.href && item.href.startsWith("#")) return "Wire the anchor to expand the collapsed detail section before focusing the target.";
  if (item.beforeUrl === item.afterUrl) return "Route to a specific existing flow, open details, or show a clear demo unavailable message.";
  return "Review destination and add visible feedback or focus state.";
}

function writeReports(results) {
  const reportLines = [
    "# User Workflow QA Report",
    "",
    `Generated from local workflow QA against \`${baseUrl}\`.`,
    "",
    "Standard: every CTA must navigate, open a modal/drawer, expand/focus details, apply a meaningful filter, start a transaction, create a draft/new flow, mark local/demo state with feedback, or show a clear unavailable message.",
    "",
    "CTA outcome clarity follow-up: `docs/cta-outcome-clarity-qa-report.md` verifies that primary and important secondary CTAs produce understandable outcomes, including route changes, expanded details, highlighted focus targets, modals, or visible feedback.",
    "",
    "## Manual Founder Review Failures",
    "",
    "- Observed behavior: Command Center `Open priority` routed generically to `/projects`; Pipeline `Open action details` only highlighted the Pipeline Details bar.",
    "- Why it failed: both CTAs technically moved somewhere, but neither landed on an exact task with a visible next-step instruction.",
    "- Fix implemented: primary cockpit CTAs now use concrete task labels and route/focus through the task outcome contract with a `You are here to` focused task panel.",
    "- Verification: this QA fails vague labels, generic route-only outcomes, generic section-only highlights, and missing focused task instructions.",
    ""
  ];

  for (const scenario of scenarios) {
    const items = results.filter((item) => item.scenarioId === scenario.id);
    const failing = items.filter((item) => item.appearsDead);
    reportLines.push(`## Scenario ${scenario.id} - ${scenario.name}`);
    reportLines.push("");
    reportLines.push(`- Route: \`${scenario.route}\``);
    reportLines.push(`- User intent: ${scenario.intent}`);
    reportLines.push(`- Expected: ${scenario.expected}`);
    reportLines.push(`- Pass/fail: ${scenarioStatus(items)}`);
    reportLines.push(`- Tested CTAs: ${items.length}`);
    reportLines.push(`- Dead ends found: ${failing.length}`);
    reportLines.push("");
    reportLines.push("| CTA | Outcome | Before | After | Notes |");
    reportLines.push("| --- | --- | --- | --- | --- |");
    for (const item of items) {
      reportLines.push(`| ${item.label || "(unlabeled)"} | ${item.appearsDead ? "Fail" : "Pass"} | ${new URL(item.beforeUrl).pathname} | ${new URL(item.afterUrl).pathname}${new URL(item.afterUrl).hash} | ${item.notes} |`);
    }
    if (items.length === 0) {
      reportLines.push("| No safe CTAs detected | Fail | - | - | Page needs at least one safe user action path. |");
    }
    reportLines.push("");
    reportLines.push(`Recommended fix: ${failing.length > 0 ? "Address failed CTAs listed in the remediation backlog." : "No must-fix CTA issue detected in safe-click QA."}`);
    reportLines.push("");
  }

  const failingItems = results.filter((item) => item.appearsDead);
  const backlogLines = [
    "# User Workflow Remediation Backlog",
    "",
    "CTA outcome clarity follow-up: `docs/cta-outcome-remediation-backlog.md` tracks whether working CTAs also produce clear visible outcomes.",
    "",
    "## Manual Founder Review Failures",
    "",
    "| Observed behavior | Why it failed | Fix implemented | Verification | Status |",
    "| --- | --- | --- | --- | --- |",
    "| Command Center `Open priority` routed to `/projects` without a focused task | User landed on Projects and still had to infer the task | Replaced vague primary CTA generation with task outcome contract and focused task panel | QA now fails cross-page cockpit CTAs without focus metadata and `You are here to` instruction | Completed |",
    "| Pipeline `Open action details` highlighted only the generic details bar | User saw a section highlight, not the exact action or next step | Same-page cockpit CTAs now open/focus the focused task panel before details | QA now fails cockpit CTAs that target only `#details-records` | Completed |",
    "",
    "## Must Fix Before Usability Review",
    "",
    "| Page | CTA label | Current behavior | Expected behavior | User impact | Recommended fix | Priority | Status |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  const mustItems = failingItems.filter((item) => !/admin/i.test(item.sourceRoute));
  if (mustItems.length === 0) {
    backlogLines.push("| All major pages | No same-page no-change failures detected by automated safe-click QA | CTAs produced navigation, details expansion, scroll/focus, modal, or feedback | Keep primary paths meaningful | Users can keep moving | Continue monitoring during manual QA | P0 | Completed |");
  } else {
    for (const item of mustItems) {
      backlogLines.push(`| ${item.sourceRoute} | ${item.label || "(unlabeled)"} | ${item.category} | Meaningful navigation, detail focus, modal, transaction, or feedback | User may think the product is broken | ${recommendationFor(item)} | P0 | Open |`);
    }
  }

  backlogLines.push("");
  backlogLines.push("## Should Fix Before Executive Demo");
  backlogLines.push("");
  backlogLines.push("| Page | CTA label | Current behavior | Expected behavior | User impact | Recommended fix | Priority | Status |");
  backlogLines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");

  const adminItems = failingItems.filter((item) => /admin/i.test(item.sourceRoute));
  if (adminItems.length === 0) {
    backlogLines.push("| /admin | No automated dead CTA detected | Readiness CTAs responded safely | Admin remains scannable | Low risk | Keep status references clear | P1 | Completed |");
  } else {
    for (const item of adminItems) {
      backlogLines.push(`| ${item.sourceRoute} | ${item.label || "(unlabeled)"} | ${item.category} | Scroll, focus, open doc reference, or show status | Admin may feel fake | ${recommendationFor(item)} | P1 | Open |`);
    }
  }

  backlogLines.push("");
  backlogLines.push("## Later");
  backlogLines.push("");
  backlogLines.push("| Page | CTA label | Current behavior | Expected behavior | User impact | Recommended fix | Priority | Status |");
  backlogLines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  backlogLines.push("| All pages | Record-level CTAs inside dense details | Many are inspect/review links in demo content | Mature into record drawers after persistence | Drill-down remains broad | Add record-specific drawers when production persistence expands | P2 | Deferred |");

  writeFileSync(reportPath, `${reportLines.join("\n")}\n`);
  writeFileSync(backlogPath, `${backlogLines.join("\n")}\n`);
}

await assertServerReady();
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const results = [];

try {
  for (const scenario of scenarios) {
    try {
      await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: "domcontentloaded", timeout: 10000 });
    } catch (error) {
      results.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        label: "Route load",
        sourceRoute: scenario.route,
        beforeUrl: `${baseUrl}${scenario.route}`,
        afterUrl: page.url(),
        urlChanged: false,
        modalOpened: false,
        detailsExpanded: false,
        pageScrolled: false,
        feedbackAppeared: false,
        appearsDead: true,
        category: "route-load-timeout",
        notes: error instanceof Error ? error.message : "Route did not load during workflow QA."
      });
      continue;
    }
    await page.waitForLoadState("domcontentloaded", { timeout: 500 }).catch(() => undefined);
    await page.waitForTimeout(120);

    const topCandidates = await collectCandidates(page);
    const openDetails = topCandidates.find((candidate) => /open details/i.test(candidate.label));
    const candidates = [
      ...topCandidates.filter((candidate) => candidate.area === "cockpit").slice(0, 3),
      ...topCandidates.filter((candidate) => candidate.area === "header").slice(0, 1)
    ];

    if (openDetails && !candidates.some((existing) => existing.index === openDetails.index)) {
      candidates.push(openDetails);
    }

    const selectedCandidates = candidates.slice(0, 3);
    for (const candidate of selectedCandidates) {
      const result = await clickCandidate(page, scenario.route, candidate);
      results.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        ...result
      });
    }
  }
} finally {
  await browser.close();
}

writeFileSync(resultsPath, `${JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
writeReports(results);

const failures = results.filter((item) => item.appearsDead);
console.log(`User workflow QA complete: ${results.length} CTA checks, ${failures.length} potential dead-end(s).`);
console.log(`Report written to ${reportPath}`);
console.log(`Backlog written to ${backlogPath}`);
