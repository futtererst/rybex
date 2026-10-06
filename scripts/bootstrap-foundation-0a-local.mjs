import { createClient } from "@supabase/supabase-js";

const runtimeMode = process.env.RYBEXOS_RUNTIME_MODE;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.FOUNDATION_0A_TEST_PASSWORD;

if (!["local", "test"].includes(runtimeMode ?? "")) {
  console.error("Foundation 0A bootstrap requires RYBEXOS_RUNTIME_MODE=local or test.");
  process.exit(1);
}

if (!url || !serviceKey || !password) {
  console.error("Foundation 0A bootstrap requires local Supabase URL, server-only service key, and in-memory test password.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ids = {
  workspaceA: "10000000-0000-4000-8000-000000000001",
  workspaceB: "10000000-0000-4000-8000-000000000002",
  orgA: "20000000-0000-4000-8000-000000000001",
  orgB: "20000000-0000-4000-8000-000000000002",
  projectA: "30000000-0000-4000-8000-000000000001",
  projectB: "30000000-0000-4000-8000-000000000002"
};

const users = [
  { key: "admin", email: "admin-a@foundation0a.local", role: "admin", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "executive", email: "executive-a@foundation0a.local", role: "executive", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "bd", email: "bd-a@foundation0a.local", role: "business_development_lead", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "ops", email: "ops-a@foundation0a.local", role: "operations_leader", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "pm", email: "pm-a@foundation0a.local", role: "project_manager", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "billing", email: "billing-a@foundation0a.local", role: "billing_commercial_lead", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "field", email: "field-a@foundation0a.local", role: "field_supervisor", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "closeout", email: "closeout-a@foundation0a.local", role: "closeout_lead", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "auditor", email: "auditor-a@foundation0a.local", role: "read_only_auditor", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true },
  { key: "suspended", email: "suspended-a@foundation0a.local", role: "operations_leader", workspaceId: ids.workspaceA, projectId: ids.projectA, membershipStatus: "suspended", projectMember: false },
  { key: "nomember", email: "nomember-a@foundation0a.local", role: "field_supervisor", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: false },
  { key: "singleFallback", email: "single-fallback-a@foundation0a.local", role: "field_supervisor", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true, activeWorkspaceId: null },
  { key: "multiAmbiguous", email: "multi-ambiguous@foundation0a.local", role: "project_manager", workspaceId: ids.workspaceA, projectId: ids.projectA, projectMember: true, activeWorkspaceId: null, alsoWorkspaceB: true },
  { key: "missingMembership", email: "missing-membership@foundation0a.local", role: "field_supervisor", workspaceId: ids.workspaceA, projectId: ids.projectA, createMembership: false, projectMember: false },
  { key: "missingProfile", email: "missing-profile@foundation0a.local", role: "field_supervisor", workspaceId: ids.workspaceA, projectId: ids.projectA, createProfile: false, createMembership: false, projectMember: false },
  { key: "userB", email: "user-b@foundation0a.local", role: "operations_leader", workspaceId: ids.workspaceB, projectId: ids.projectB, projectMember: true }
];

await upsertCoreRows();

const userIds = {};
for (const user of users) {
  const userId = await ensureAuthUser(user.email);
  userIds[user.key] = userId;

  if (user.createProfile !== false) {
    await upsertProfile({
      userId,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId,
      activeWorkspaceId: user.activeWorkspaceId === undefined ? user.workspaceId : user.activeWorkspaceId
    });
  }

  if (user.createMembership !== false) {
    await upsertMembership({
      userId,
      role: user.role,
      workspaceId: user.workspaceId,
      status: user.membershipStatus ?? "active"
    });
  }

  if (user.projectMember) {
    await upsertProjectMembership({ userId, workspaceId: user.workspaceId, projectId: user.projectId });
  }

  if (user.alsoWorkspaceB) {
    await upsertProfile({
      userId,
      email: user.email,
      role: user.role,
      workspaceId: ids.workspaceA,
      activeWorkspaceId: null
    });
    await upsertMembership({ userId, role: user.role, workspaceId: ids.workspaceB, status: "active" });
    await upsertProjectMembership({ userId, workspaceId: ids.workspaceB, projectId: ids.projectB });
  }
}

console.log(JSON.stringify({
  status: "ok",
  workspaces: 2,
  projects: 2,
  users: users.length,
  suspendedMemberships: 1,
  multiWorkspaceAmbiguityUsers: 1
}));

async function ensureAuthUser(email) {
  const listed = await supabase.auth.admin.listUsers();
  const existing = listed.data.users.find((user) => user.email === email);
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true
    });
    return existing.id;
  }

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (created.error || !created.data.user?.id) {
    throw new Error(created.error?.message ?? `Unable to create ${email}.`);
  }

  return created.data.user.id;
}

async function upsertCoreRows() {
  await upsert("organizations", [
    { id: ids.orgA, name: "Foundation Workspace A Organization", slug: "foundation-a", status: "active" },
    { id: ids.orgB, name: "Foundation Workspace B Organization", slug: "foundation-b", status: "active" }
  ], "id");

  await upsert("workspaces", [
    { id: ids.workspaceA, organization_id: ids.orgA, name: "Workspace A", slug: "workspace-a", status: "active" },
    { id: ids.workspaceB, organization_id: ids.orgB, name: "Workspace B", slug: "workspace-b", status: "active" }
  ], "id");

  await upsert("projects", [
    {
      id: ids.projectA,
      organization_id: ids.orgA,
      workspace_id: ids.workspaceA,
      name: "Foundation Project A",
      gc_client: "Foundation GC",
      d5o_phase: "deploy",
      health_status: "watch"
    },
    {
      id: ids.projectB,
      organization_id: ids.orgB,
      workspace_id: ids.workspaceB,
      name: "Foundation Project B",
      gc_client: "Foundation GC",
      d5o_phase: "deploy",
      health_status: "watch"
    }
  ], "id");
}

async function upsertProfile({ userId, email, role, workspaceId, activeWorkspaceId }) {
  const workspace = workspaceFor(workspaceId);
  await upsert("user_profiles", [{
    user_id: userId,
    auth_user_id: userId,
    email,
    display_name: email.split("@")[0],
    default_role: role,
    active_workspace_id: activeWorkspaceId,
    status: "active",
    ...workspace
  }], "user_id");
}

async function upsertMembership({ userId, role, workspaceId, status }) {
  const profile = await single("user_profiles", "id", "user_id", userId);
  await upsert("workspace_memberships", [{
    ...workspaceFor(workspaceId),
    user_profile_id: profile.id,
    user_id: userId,
    role,
    status
  }], "workspace_id,user_id");
}

async function upsertProjectMembership({ userId, workspaceId, projectId }) {
  const profile = await single("user_profiles", "id", "user_id", userId);
  await upsert("project_memberships", [{
    ...workspaceFor(workspaceId),
    project_id: projectId,
    user_id: userId,
    user_profile_id: profile.id,
    status: "active"
  }], "project_id,user_id");
}

function workspaceFor(workspaceId) {
  if (workspaceId === ids.workspaceA) {
    return { organization_id: ids.orgA, workspace_id: ids.workspaceA };
  }
  return { organization_id: ids.orgB, workspace_id: ids.workspaceB };
}

async function upsert(table, rows, onConflict) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
}

async function single(table, select, column, value) {
  const { data, error } = await supabase.from(table).select(select).eq(column, value).single();
  if (error || !data) throw new Error(`${table} lookup failed: ${error?.message ?? "missing row"}`);
  return data;
}
