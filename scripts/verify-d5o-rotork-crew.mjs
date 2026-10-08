import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { context } from "./m1/implementation-context.mjs";

const c = await context();
const base = "http://127.0.0.1:61430";
const output = resolve("artifacts/d5o-prototype-crew-receipts-20261003");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
async function signIn(email, next) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.route("**/*", (route) => [base, "http://127.0.0.1:61421"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  const page = await ctx.newPage();
  await page.goto(`${base}/auth/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact:true }).fill(email);
  await page.getByLabel("Password", { exact:true }).fill(c.env.FOUNDATION_0A_TEST_PASSWORD);
  await page.getByRole("button", { name:"Continue to your work" }).click();
  await page.waitForURL(`**${next}`);
  return { ctx, page };
}
try {
  const editorMembership = await c.service.from("workspace_memberships").select("user_id")
    .eq("workspace_id", "fd59e25e-8fa3-496c-8e1f-58a3f0c0fdb6").eq("role", "project_manager").eq("status", "active").limit(1).single();
  assert.ok(!editorMembership.error && editorMembership.data?.user_id);
  const editorProfile = await c.service.from("user_profiles").select("email").eq("user_id", editorMembership.data.user_id).single();
  assert.ok(!editorProfile.error && editorProfile.data?.email);
  const editor = await signIn(editorProfile.data.email, "/work");
  const plan = await editor.page.evaluate(async () => (await fetch("/api/work/schedule")).json());
  assert.equal(plan.schedule.workspace, "rotork");
  const latest = plan.schedule.publications.filter((item) => item.week === 0).at(-1);
  if (!latest) {
    const publication = await editor.page.evaluate(async (revision) => {
      const response = await fetch("/api/work/schedule", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"publish",week:0,expectedRevision:revision}) });
      return {status:response.status,data:await response.json()};
    }, plan.schedule.revision);
    assert.equal(publication.status, 200, JSON.stringify(publication.data));
  }
  await editor.ctx.close();

  const priya = await signIn("crew-rotork-priya-shah@d5o-synthetic.local", "/work/my-schedule");
  await priya.page.getByRole("heading", { name:"Offshore Actuator Modernization" }).waitFor();
  const view = await priya.page.evaluate(async () => (await fetch("/api/work/my-schedule")).json());
  assert.equal(view.workspace, "rotork");
  assert.equal(view.person, "Priya Shah");
  assert.ok(view.bookings.length && view.bookings.every((item) => item.workId.startsWith("rotork-")));
  if (!view.bookings[0].response) {
    await priya.page.getByRole("button", { name:"Accept booking" }).first().click();
    await priya.page.getByRole("button", { name:"Confirm response" }).click();
  }
  await priya.page.getByText("Accepted by you").waitFor();
  await priya.page.screenshot({ path:resolve(output,"rotork-crew-acknowledged.png"), fullPage:true });
  await priya.page.reload();
  await priya.page.getByText("Accepted by you").waitFor();
  await priya.ctx.close();
  writeFileSync(resolve(output,"ROTORK-RESULTS.json"),JSON.stringify({status:"PASS",checks:["synthetic Rotork publication","authenticated scoped direct receipt","durable reload"]},null,2));
  console.log(JSON.stringify({status:"PASS",checks:3,output}));
} finally { await browser.close(); }
