import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const component = read("components/layout/PrimaryNav.tsx");
const model = read("components/layout/primary-nav-model.ts");
const layout = read("app/layout.tsx");
const modules = read("lib/d5o/modules.ts");
const signOut = read("app/auth/sign-out/route.ts");

assert.match(component, /export type \{ PrimaryNavProps \}/, "PrimaryNav must export its explicit prop contract.");
assert.match(component, /\}: PrimaryNavProps\)/, "The canonical component must consume the explicit prop contract.");
assert.match(layout, /satisfies PrimaryNavProps/, "RootLayout must construct props against the canonical contract.");
for (const prop of ["productionMode", "currentRole", "currentRoleLabel", "currentUserName"]) {
  assert.match(component, new RegExp(`\\b${prop}\\b`), `PrimaryNav must consume ${prop}.`);
  assert.match(layout, new RegExp(`\\b${prop}\\b`), `RootLayout must provide ${prop}.`);
}

for (const href of ["/command-center", "/field-execution", "/rfis-submittals", "/changes", "/billing", "/closeout"]) {
  assert.ok(model.includes(`"${href}"`), `Core navigation must retain ${href}.`);
}
assert.ok(model.includes("canAccessModule"), "Role-aware navigation must use canonical RBAC authority.");
assert.ok(model.includes("productionMode") && model.includes("otherItems"), "Production containment must remain intentional.");
assert.ok(component.includes("desktop-nav-shell") && component.includes("mobile-nav-menu"), "Desktop and responsive navigation must both render.");
assert.ok(component.includes("Other modules") && component.includes("nav-link-contained"), "Secondary destinations must remain contained.");
assert.ok(component.includes("item.href") && component.includes("item.label"), "Links and labels must come from canonical navigation data.");

const modelHrefs = [...model.matchAll(/"(\/[a-z-]+)":\s*"[a-z-]+"/g)].map((match) => match[1]);
for (const href of modelHrefs) {
  assert.ok(modules.includes(`href: "${href}"`) || modules.includes(`href: "${href}"`), `Navigation helper must not fabricate ${href}.`);
}

assert.ok(modules.includes('href: "/pipeline"'), "Pipeline must remain a canonical destination.");
assert.ok(existsSync(resolve(root, "app/pipeline/page.tsx")), "Pipeline index route must remain reachable.");
assert.ok(existsSync(resolve(root, "app/pipeline/[opportunityId]/page.tsx")), "CFG-RUNTIME-03 opportunity route must remain reachable.");
assert.ok(signOut.includes("signOut"), "Existing sign-out behavior must remain intact.");

const visibleSource = `${component}\n${model}\n${layout}`;
assert.doesNotMatch(visibleSource, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b(?:ops|bd|pm|admin)-[a-z0-9]+\b/i, "Navigation must not expose fixture or raw identifiers.");

console.log("PrimaryNav focused contract verification passed.");
