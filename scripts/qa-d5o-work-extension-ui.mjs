import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { context, createWork } from './m1/implementation-context.mjs';

const base = 'http://127.0.0.1:61431';
const plan = JSON.parse(readFileSync('artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json'));
const password = readFileSync('.rybexos-local/m1-s1/brc-test-password', 'utf8').trim();
const c = await context();
const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  for (const fixture of plan.scenarios) {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    const owner = await c.login(fixture.actors.preparer.email);
    const record = (await createWork(owner, fixture, `Synthetic ${fixture.name} extension browser journey`)).workId;
    const destination = `/work/${fixture.workspace}/${record}`;
    await page.goto(`${base}/auth/sign-in?next=${encodeURIComponent(destination)}`);
    await page.getByLabel('Email', { exact: true }).fill(fixture.actors.preparer.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Continue to your work', exact: true }).click();
    await page.waitForURL(`**${destination}`);
    assert(await page.getByRole('heading', { name: 'Controlled Work Packages' }).isVisible());
    const packageName = `QA controlled package ${Date.now()} ${fixture.name}`;
    const create = page.locator('form').filter({ has: page.locator('input[name="packageKey"]') });
    await create.getByLabel('Package name').fill(packageName);
    await create.getByRole('button', { name: 'Create Work Package' }).click();
    await page.waitForURL('**?result=recorded#plan');
    assert(await page.getByText(packageName, { exact: true }).first().isVisible());
    checks.push(`${fixture.name}: owner creates a scoped Work Package through the server command`);
    const packageCard = page.locator('.d5o-extension-packages article').filter({ hasText: packageName });
    await packageCard.getByLabel('Installed %').fill('80');
    await packageCard.getByLabel('Tested %').fill('60');
    await packageCard.getByRole('button', { name: 'Record work facts' }).click();
    await page.waitForURL('**?result=recorded#execution');
    await page.reload();
    assert.match(await page.locator('.d5o-extension-packages article').filter({ hasText: packageName }).innerText(), /80% installed · 60% tested · 0% accepted/);
    checks.push(`${fixture.name}: installed/tested facts survive reload without manufacturing acceptance`);
    const actionName = `QA follow-up ${Date.now()} ${fixture.name}`;
    const lifecycle = page.locator('form').filter({ has: page.locator('input[name="action"]') });
    await lifecycle.getByLabel('Lifecycle action').fill(actionName);
    await lifecycle.getByRole('button', { name: 'Plan lifecycle action' }).click();
    await page.waitForURL('**?result=recorded#handoff');
    await page.reload();
    assert(await page.getByText(actionName).isVisible());
    checks.push(`${fixture.name}: lifecycle follow-through survives reload`);
    const extensions = await page.evaluate(async ({ workspaceId, workId }) => {
      const response = await fetch(`/api/work/extensions?workspaceId=${workspaceId}&workId=${workId}`, { cache: 'no-store' });
      return { status: response.status, body: await response.json() };
    }, { workspaceId: fixture.workspace, workId: record });
    assert.equal(extensions.status, 200);
    assert(extensions.body.extensions.packages.some((item) => item.name === packageName));
    await page.context().close();
  }
  console.log(JSON.stringify({ status: 'PASS', checks }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', checks, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally { await browser.close(); }
