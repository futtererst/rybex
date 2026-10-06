import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const packageJson = JSON.parse(read("package.json"));
const nextVersion = packageJson.dependencies?.next ?? packageJson.devDependencies?.next ?? "";
const ssrVersion = packageJson.dependencies?.["@supabase/ssr"] ?? "";
const proxy = exists("proxy.ts") ? read("proxy.ts") : "";
const browserClient = exists("lib/d5o/auth/supabase-browser.ts") ? read("lib/d5o/auth/supabase-browser.ts") : "";
const serverClient = exists("lib/d5o/auth/supabase-server.ts") ? read("lib/d5o/auth/supabase-server.ts") : "";
const requestContext = exists("lib/d5o/auth/request-context.ts") ? read("lib/d5o/auth/request-context.ts") : "";
const signInPage = exists("app/auth/sign-in/page.tsx") ? read("app/auth/sign-in/page.tsx") : "";
const signInAction = exists("app/auth/sign-in/actions.ts") ? read("app/auth/sign-in/actions.ts") : "";
const signOut = exists("app/auth/sign-out/route.ts") ? read("app/auth/sign-out/route.ts") : "";
const redirects = exists("lib/d5o/auth/redirects.ts") ? read("lib/d5o/auth/redirects.ts") : "";
const coreJourney = exists("scripts/qa-foundation-0f-core-journey.mjs") ? read("scripts/qa-foundation-0f-core-journey.mjs") : "";
const authQa = exists("scripts/qa-foundation-0f-auth-session.mjs") ? read("scripts/qa-foundation-0f-auth-session.mjs") : "";

check(/^16\./.test(nextVersion), `Next.js version must be inspected and remain on the Proxy-capable 16.x stack. Found ${nextVersion || "missing"}.`);
check(Boolean(ssrVersion), "@supabase/ssr dependency must be installed.");
check(exists("proxy.ts"), "Root proxy.ts must exist.");
check(!exists("middleware.ts"), "Deprecated root middleware.ts must be removed when Proxy is used.");
check(proxy.includes("createServerClient"), "Proxy must create a Supabase SSR server client.");
check(proxy.includes("auth.getUser"), "Proxy must verify auth with getUser, not trust getSession alone.");
check(proxy.includes("request.cookies.getAll") && proxy.includes("response.cookies.set"), "Proxy must read and propagate Supabase session cookies.");
check(proxy.includes("/auth/sign-in") && proxy.includes("NextResponse.redirect"), "Proxy must redirect protected unauthenticated page requests to sign-in.");
check(proxy.includes("isProductionRouteAvailable") && proxy.includes("503"), "Proxy must preserve production module containment.");
check(proxy.includes("cache-control") && proxy.includes("no-store"), "Auth-changing proxy responses must avoid public caching.");
check(browserClient.includes("createBrowserClient"), "Browser Supabase client must use createBrowserClient.");
check(!browserClient.includes("SERVICE_ROLE") && !browserClient.includes("SUPABASE_SECRET"), "Browser client must not reference service-role secrets.");
check(serverClient.includes("createServerClient") && serverClient.includes("cookies()"), "Server Supabase client must use App Router cookies.");
check(serverClient.includes("server-only"), "Server Supabase client must be server-only.");
check(signInPage.includes("name=\"email\"") && signInPage.includes("name=\"password\""), "Sign-in page must expose email and password fields.");
check(signInAction.includes("signInWithPassword"), "Sign-in action must use real Supabase password authentication.");
check(signInAction.includes("safeInternalRedirectPath"), "Sign-in action must validate next redirects.");
check(redirects.includes("startsWith(\"//\")") && redirects.includes("DEFAULT_AUTH_REDIRECT"), "Safe redirect helper must reject protocol-relative/external destinations.");
check(signOut.includes("auth.signOut") && signOut.includes("/auth/sign-in"), "Sign-out route must call Supabase signOut and redirect to sign-in.");
check(requestContext.includes("auth.getUser") && requestContext.includes("workspace_memberships"), "Request context must independently verify auth and workspace membership.");
check(exists("app/api/auth/session-proof/route.ts"), "Redacted authenticated session proof route must exist.");
check(!read("package.json").includes("package-output/rybexos-demo-package"), "Historical package-output tree must not be referenced.");
check(!authQa.includes("addCookies") && !authQa.includes("storageState"), "Auth-session QA must not inject cookies or use storage state.");
check(!coreJourney.includes("FOUNDATION_0F_BROWSER_AUTH_COOKIE_READY"), "Core journey must not use the old browser-auth placeholder flag.");
check(!authQa.includes("SERVICE_ROLE_KEY") || authQa.includes("service-role credential") || authQa.includes("serviceRoleAbsent"), "Auth-session QA must not use service role as a browser bypass.");

if (failures.length > 0) {
  console.error("Foundation 0F auth session bridge verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation 0F auth session bridge static verification passed.");
console.log(JSON.stringify({ nextVersion, supabaseSsrVersion: ssrVersion }, null, 2));
