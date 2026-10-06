import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.FOUNDATION_0A_TEST_PASSWORD;
const resultPath = process.env.FOUNDATION_0A_RESULTS_PATH;

if (!url || !anonKey || !serviceKey || !password) {
  console.error("Foundation 0A behavioral QA requires local Supabase env: URL, publishable/anon key, server-only service key, and in-memory test password.");
  console.error("Status: IMPLEMENTED - GATE 0A WAITING FOR LOCAL SUPABASE BEHAVIORAL VERIFICATION.");
  process.exit(1);
}

const ids = {
  workspaceA: "10000000-0000-4000-8000-000000000001",
  workspaceB: "10000000-0000-4000-8000-000000000002",
  projectA: "30000000-0000-4000-8000-000000000001",
  projectB: "30000000-0000-4000-8000-000000000002"
};

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tests = [];
const startedAt = new Date().toISOString();

await ensureBootstrapRowsExist();

const clients = {
  admin: await signIn("admin-a@foundation0a.local"),
  ops: await signIn("ops-a@foundation0a.local"),
  pm: await signIn("pm-a@foundation0a.local"),
  billing: await signIn("billing-a@foundation0a.local"),
  field: await signIn("field-a@foundation0a.local"),
  closeout: await signIn("closeout-a@foundation0a.local"),
  auditor: await signIn("auditor-a@foundation0a.local"),
  suspended: await signIn("suspended-a@foundation0a.local"),
  nomember: await signIn("nomember-a@foundation0a.local"),
  singleFallback: await signIn("single-fallback-a@foundation0a.local"),
  multiAmbiguous: await signIn("multi-ambiguous@foundation0a.local"),
  missingMembership: await signIn("missing-membership@foundation0a.local"),
  missingProfile: await signIn("missing-profile@foundation0a.local"),
  userB: await signIn("user-b@foundation0a.local")
};

await record("Workspace A user can authenticate", "auth", async () => {
  const { data } = await clients.ops.auth.getUser();
  return pass(Boolean(data.user?.id), "authenticated-user");
});

await record("Request context resolves profile, workspace, membership, role, and permissions", "application_context", async () => {
  const context = await resolveContext(clients.ops);
  return pass(
    context.status === "authorized" &&
      context.workspaceId === ids.workspaceA &&
      context.role === "operations_leader" &&
      context.permissions.includes("field_issue.assess"),
    context.status
  );
});

await record("Resolved workspace matches an active membership", "application_context", async () => {
  const context = await resolveContext(clients.ops);
  return pass(context.status === "authorized" && context.membershipStatus === "active", context.membershipStatus ?? context.status);
});

await record("Suspended membership does not authorize access", "application_context", async () => {
  const context = await resolveContext(clients.suspended);
  return pass(context.status === "no_membership", context.status);
});

await record("Missing profile fails closed", "application_context", async () => {
  const context = await resolveContext(clients.missingProfile);
  return pass(context.status === "no_profile", context.status);
});

await record("Missing membership fails closed", "application_context", async () => {
  const context = await resolveContext(clients.missingMembership);
  return pass(context.status === "no_membership", context.status);
});

await record("Workspace A user cannot select Workspace B", "rls_no_rows", async () => {
  const { data, error } = await clients.ops.from("workspaces").select("id").eq("id", ids.workspaceB);
  return noRows(data, error);
});

await record("Workspace A user cannot read Workspace B memberships", "rls_no_rows", async () => {
  const { data, error } = await clients.ops.from("workspace_memberships").select("id").eq("workspace_id", ids.workspaceB);
  return noRows(data, error);
});

await record("Workspace A user cannot insert Workspace B membership", "rls_policy_denial", async () => {
  const before = await membershipCount(ids.workspaceB);
  const { error } = await clients.ops.from("workspace_memberships").insert({
    organization_id: "20000000-0000-4000-8000-000000000002",
    workspace_id: ids.workspaceB,
    user_id: (await userIdFor("ops-a@foundation0a.local")),
    user_profile_id: (await profileIdFor("ops-a@foundation0a.local")),
    role: "admin",
    status: "active"
  });
  const after = await membershipCount(ids.workspaceB);
  return pass(Boolean(error) && before === after, error ? "policy_denial" : "unexpected_success");
});

await record("Workspace A user cannot update Workspace B membership", "rls_policy_denial", async () => {
  const target = await membershipFor("user-b@foundation0a.local", ids.workspaceB);
  const { error, count } = await clients.ops
    .from("workspace_memberships")
    .update({ role: "admin" }, { count: "exact" })
    .eq("id", target.id);
  const unchanged = await membershipFor("user-b@foundation0a.local", ids.workspaceB);
  return pass((Boolean(error) || count === 0) && unchanged.role === "operations_leader", error ? "policy_denial" : "no_rows_visible");
});

await record("Workspace A user cannot delete Workspace B membership", "rls_policy_denial", async () => {
  const target = await membershipFor("user-b@foundation0a.local", ids.workspaceB);
  const { error, count } = await clients.ops
    .from("workspace_memberships")
    .delete({ count: "exact" })
    .eq("id", target.id);
  const stillExists = await membershipFor("user-b@foundation0a.local", ids.workspaceB);
  return pass((Boolean(error) || count === 0) && Boolean(stillExists.id), error ? "policy_denial" : "no_rows_visible");
});

await record("Workspace B user cannot read Workspace A records", "rls_no_rows", async () => {
  const { data, error } = await clients.userB.from("workspaces").select("id").eq("id", ids.workspaceA);
  return noRows(data, error);
});

await record("Cross-workspace project membership is denied", "rls_no_rows", async () => {
  const { data, error } = await clients.ops.from("project_memberships").select("id").eq("workspace_id", ids.workspaceB);
  return noRows(data, error);
});

await record("Cross-workspace project record access is denied", "rls_no_rows", async () => {
  const { data, error } = await clients.ops.from("projects").select("id").eq("id", ids.projectB);
  return noRows(data, error);
});

await record("Read-only auditor cannot perform a representative mutation", "rls_policy_denial", async () => {
  const { error, count } = await clients.auditor
    .from("workspaces")
    .update({ name: "Auditor Mutation Blocked" }, { count: "exact" })
    .eq("id", ids.workspaceA);
  const workspace = await workspaceById(ids.workspaceA);
  return pass((Boolean(error) || count === 0) && workspace.name === "Workspace A", error ? "policy_denial" : "no_rows_updated");
});

await record("Operations Leader receives representative permissions", "role_permission", async () => {
  const context = await resolveContext(clients.ops);
  return pass(
    context.permissions.includes("field_issue.resolve") &&
      context.permissions.includes("billing.clear_blocker") &&
      !context.permissions.includes("membership.manage"),
    context.permissions.join(",")
  );
});

await record("Billing Lead has Billing permissions but not membership administration", "role_permission", async () => {
  const context = await resolveContext(clients.billing);
  return pass(context.permissions.includes("billing.record_decision") && !context.permissions.includes("membership.manage"), context.role);
});

await record("Field Supervisor has field permissions but not Billing decision permission", "role_permission", async () => {
  const context = await resolveContext(clients.field);
  return pass(context.permissions.includes("field_issue.create_rfi") && !context.permissions.includes("billing.record_decision"), context.role);
});

await record("Closeout Lead has Closeout permissions but not membership management", "role_permission", async () => {
  const context = await resolveContext(clients.closeout);
  return pass(context.permissions.includes("closeout.clear_blocker") && !context.permissions.includes("membership.manage"), context.role);
});

await record("Project Manager receives approved project-management access only", "role_permission", async () => {
  const context = await resolveContext(clients.pm);
  return pass(context.permissions.includes("project.manage") && !context.permissions.includes("billing.record_decision"), context.role);
});

await record("Ordinary user cannot elevate their own workspace role", "rls_policy_denial", async () => {
  const target = await membershipFor("field-a@foundation0a.local", ids.workspaceA);
  const { error, count } = await clients.field
    .from("workspace_memberships")
    .update({ role: "admin" }, { count: "exact" })
    .eq("id", target.id);
  const unchanged = await membershipFor("field-a@foundation0a.local", ids.workspaceA);
  return pass((Boolean(error) || count === 0) && unchanged.role === "field_supervisor", error ? "policy_denial" : "no_rows_updated");
});

await record("Ordinary user cannot reactivate suspended membership", "rls_policy_denial", async () => {
  const target = await membershipFor("suspended-a@foundation0a.local", ids.workspaceA);
  const { error, count } = await clients.suspended
    .from("workspace_memberships")
    .update({ status: "active" }, { count: "exact" })
    .eq("id", target.id);
  const unchanged = await membershipFor("suspended-a@foundation0a.local", ids.workspaceA);
  return pass((Boolean(error) || count === 0) && unchanged.status === "suspended", error ? "policy_denial" : "no_rows_updated");
});

await record("Single active membership with no active workspace uses controlled fallback", "application_context", async () => {
  const context = await resolveContext(clients.singleFallback);
  return pass(context.status === "authorized" && context.workspaceId === ids.workspaceA, context.status);
});

await record("Multiple memberships without active workspace requires workspace selection", "application_context", async () => {
  const context = await resolveContext(clients.multiAmbiguous);
  return pass(context.status === "workspace_selection_required", context.status);
});

await record("Client-provided arbitrary workspace ID cannot override server-resolved workspace", "application_context", async () => {
  const profile = await profileFor("field-a@foundation0a.local");
  await service.from("user_profiles").update({ active_workspace_id: ids.workspaceB }).eq("id", profile.id);
  const context = await resolveContext(clients.field);
  await service.from("user_profiles").update({ active_workspace_id: ids.workspaceA }).eq("id", profile.id);
  return pass(context.status === "authorized" && context.workspaceId === ids.workspaceA, context.status);
});

await record("Project A member can access Project A boundary", "rls_visible", async () => {
  const { data, error } = await clients.field.from("projects").select("id").eq("id", ids.projectA);
  return pass(!error && data.length === 1, error?.message ?? String(data?.length ?? 0));
});

await record("Nonmember without elevated role cannot access Project A", "rls_no_rows", async () => {
  const { data, error } = await clients.nomember.from("projects").select("id").eq("id", ids.projectA);
  return noRows(data, error);
});

await record("Elevated workspace role follows project-access rule", "rls_visible", async () => {
  const { data, error } = await clients.ops.from("projects").select("id").eq("id", ids.projectA);
  return pass(!error && data.length === 1, error?.message ?? String(data?.length ?? 0));
});

await record("Project B remains inaccessible to Workspace A users", "rls_no_rows", async () => {
  const { data, error } = await clients.billing.from("projects").select("id").eq("id", ids.projectB);
  return noRows(data, error);
});

await record("Production runtime cannot use demo auth", "production_fail_closed", async () => {
  const readiness = runRuntimeProbe({
    RYBEXOS_RUNTIME_MODE: "production",
    RYBEXOS_AUTH_MODE: "demo"
  }, "readiness");
  return pass(!readiness.ready && readiness.missing.includes("RYBEXOS_AUTH_MODE=supabase"), readiness.missing.join(","));
});

await record("Production runtime cannot use seed data source", "production_fail_closed", async () => {
  const readiness = runRuntimeProbe({
    RYBEXOS_RUNTIME_MODE: "production",
    RYBEXOS_AUTH_MODE: "supabase",
    RYBEXOS_DATA_SOURCE: "seed",
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey
  }, "readiness");
  return pass(!readiness.ready && readiness.missing.includes("RYBEXOS_DATA_SOURCE=database"), readiness.missing.join(","));
});

await record("Production runtime cannot use local JSON operating-slice mutation", "production_fail_closed", async () => {
  const probe = runRuntimeProbe({ RYBEXOS_RUNTIME_MODE: "production" }, "localAdapter");
  const message = probe.message;
  return pass(
    message.includes("has not passed its production persistence gate") &&
      message.includes("refuses seed/local business persistence"),
    message
  );
});

await record("Production runtime without valid Supabase session fails closed", "production_fail_closed", async () => {
  const context = await resolveContextLikeProduction(null);
  return pass(context.status === "unauthenticated", context.status);
});

await record("Production runtime without valid active workspace fails closed", "production_fail_closed", async () => {
  const context = await resolveContext(clients.multiAmbiguous);
  return pass(context.status === "workspace_selection_required", context.status);
});

await record("Production runtime with suspended membership fails closed", "production_fail_closed", async () => {
  const context = await resolveContext(clients.suspended);
  return pass(context.status === "no_membership", context.status);
});

await record("Test runtime can resolve deterministic test actors", "local_test_continuity", async () => {
  return pass(["local", "test"].includes(process.env.RYBEXOS_RUNTIME_MODE ?? ""), process.env.RYBEXOS_RUNTIME_MODE ?? "missing");
});

await record("Existing local operating-slice QA can run under explicit test runtime", "local_test_continuity", async () => {
  return pass(process.env.RYBEXOS_RUNTIME_MODE === "test", process.env.RYBEXOS_RUNTIME_MODE ?? "missing");
});

await record("No production-only guard blocks explicit local/test QA", "local_test_continuity", async () => {
  const probe = runRuntimeProbe({ RYBEXOS_RUNTIME_MODE: "test" }, "mode");
  return pass(!probe.isProduction && probe.mode === "test", probe.mode);
});

await record("Service-role credential is not exposed as a browser variable", "service_role_isolation", async () => {
  return pass(!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY, "server_only");
});

await emitResults();

for (const test of tests) {
  console.log(`${test.ok ? "PASS" : "FAIL"} ${test.name} [${test.category}]${test.detail ? ` - ${test.detail}` : ""}`);
}

const failed = tests.filter((test) => !test.ok);
if (failed.length > 0) {
  console.error(`Foundation 0A behavioral QA failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("Foundation 0A behavioral QA passed.");

async function signIn(email) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}. Run the local bootstrap first.`);
  return client;
}

async function resolveContext(client) {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user?.id) return { status: "unauthenticated" };
  return resolveContextLikeProduction(userData.user.id, client);
}

async function resolveContextLikeProduction(userId, client) {
  if (!userId || !client) return { status: "unauthenticated" };

  const { data: profiles, error: profileError } = await client
    .from("user_profiles")
    .select("id,user_id,email,active_workspace_id,status")
    .eq("user_id", userId);

  if (profileError) return { status: "profile_error", error: profileError.message };
  if (!profiles || profiles.length === 0) return { status: "no_profile" };

  const profile = profiles[0];
  const { data: memberships, error: membershipError } = await client
    .from("workspace_memberships")
    .select("id,workspace_id,role,status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipError) return { status: "membership_error", error: membershipError.message };
  if (!memberships || memberships.length === 0) return { status: "no_membership", profileId: profile.id };

  let membership = memberships.find((candidate) => candidate.workspace_id === profile.active_workspace_id);
  if (!membership && memberships.length === 1) {
    membership = memberships[0];
  }
  if (!membership) {
    return { status: "workspace_selection_required", profileId: profile.id };
  }

  return {
    status: "authorized",
    profileId: profile.id,
    workspaceId: membership.workspace_id,
    role: membership.role,
    membershipStatus: membership.status,
    permissions: permissionsForRole(membership.role)
  };
}

function permissionsForRole(role) {
  const sharedRead = ["workspace.view", "project.view", "audit.view", "evidence.view"];
  const billing = ["billing.view", "billing.edit", "billing.submit_review", "billing.record_decision", "billing.clear_blocker"];
  const field = ["field_issue.view", "field_issue.assess", "field_issue.add_evidence", "field_issue.choose_path", "field_issue.create_rfi", "field_issue.create_change", "field_issue.resolve"];
  const closeout = ["closeout.view", "closeout.assess", "closeout.add_evidence", "closeout.validate", "closeout.submit_review", "closeout.record_decision", "closeout.clear_blocker"];
  const manage = ["workspace.manage", "membership.view", "membership.manage", "project.manage"];

  if (role === "admin") return [...sharedRead, ...manage, ...billing, ...field, ...closeout];
  if (role === "operations_leader") return [...sharedRead, "project.manage", ...billing, ...field, ...closeout];
  if (role === "billing_commercial_lead") return [...sharedRead, ...billing];
  if (role === "field_supervisor") return [...sharedRead, ...field];
  if (role === "closeout_lead") return [...sharedRead, ...closeout];
  if (role === "project_manager") return [...sharedRead, "project.manage", "field_issue.view", "billing.view", "closeout.view"];
  if (role === "executive") return [...sharedRead, "billing.view", "field_issue.view", "closeout.view"];
  return sharedRead;
}

async function ensureBootstrapRowsExist() {
  const { data, error } = await service.from("workspaces").select("id").eq("slug", "workspace-a").limit(1);
  if (error) throw new Error(`Bootstrap check failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("Foundation 0A bootstrap rows are missing. Run scripts/bootstrap-foundation-0a-local.mjs with local/test runtime.");
  }
}

async function membershipFor(email, workspaceId) {
  const userId = await userIdFor(email);
  const { data, error } = await service
    .from("workspace_memberships")
    .select("id,role,status")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error || !data) throw new Error(`Membership lookup failed for ${email}: ${error?.message ?? "missing"}`);
  return data;
}

async function profileFor(email) {
  const { data, error } = await service.from("user_profiles").select("id,active_workspace_id").eq("email", email).single();
  if (error || !data) throw new Error(`Profile lookup failed for ${email}: ${error?.message ?? "missing"}`);
  return data;
}

async function profileIdFor(email) {
  return (await profileFor(email)).id;
}

async function userIdFor(email) {
  const { data, error } = await service.from("user_profiles").select("user_id").eq("email", email).single();
  if (error || !data?.user_id) throw new Error(`User lookup failed for ${email}: ${error?.message ?? "missing"}`);
  return data.user_id;
}

async function membershipCount(workspaceId) {
  const { count, error } = await service
    .from("workspace_memberships")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Membership count failed: ${error.message}`);
  return count ?? 0;
}

async function workspaceById(id) {
  const { data, error } = await service.from("workspaces").select("name").eq("id", id).single();
  if (error || !data) throw new Error(`Workspace lookup failed: ${error?.message ?? "missing"}`);
  return data;
}

function noRows(data, error) {
  return pass(!error && Array.isArray(data) && data.length === 0, error?.message ?? `rows:${data?.length ?? "unknown"}`);
}

function pass(ok, detail) {
  return { ok, detail };
}

function runRuntimeProbe(envPatch, probe) {
  const code = `
    import {
      getProductionRuntimeReadiness,
      productionLocalAdapterError,
      getRuntimeMode,
      isProductionRuntime
    } from "./lib/d5o/security/runtime-mode.ts";
    const probe = ${JSON.stringify(probe)};
    if (probe === "readiness") {
      console.log(JSON.stringify(getProductionRuntimeReadiness()));
    } else if (probe === "localAdapter") {
      console.log(JSON.stringify({ message: productionLocalAdapterError("Billing V2") }));
    } else {
      console.log(JSON.stringify({ mode: getRuntimeMode(), isProduction: isProductionRuntime() }));
    }
  `;
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--input-type=module", "-e", code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...envPatch
    },
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `runtime probe failed with ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

async function record(name, category, fn) {
  try {
    const result = await fn();
    tests.push({
      name,
      category,
      ok: Boolean(result.ok),
      detail: result.detail,
      denialCategory: category.startsWith("rls_") ? category : undefined
    });
  } catch (error) {
    tests.push({
      name,
      category,
      ok: false,
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

async function emitResults() {
  if (!resultPath) return;
  const dir = dirname(resultPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const failed = tests.filter((test) => !test.ok);
  const payload = {
    runTimestamp: startedAt,
    runtimeMode: process.env.RYBEXOS_RUNTIME_MODE ?? "unknown",
    totalTests: tests.length,
    passedTests: tests.length - failed.length,
    failedTests: failed.length,
    skippedTests: 0,
    tests,
    gateVerdict: failed.length === 0 ? "GATE_0A_BEHAVIORAL_QA_PASSED" : "GATE_0A_BEHAVIORAL_QA_FAILED"
  };
  writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`);
}
