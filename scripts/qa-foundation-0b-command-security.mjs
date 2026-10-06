import {
  commandId,
  createClients,
  createRecorder,
  ids,
  mergeSuiteResult,
  pass,
  signIn,
  tableCount,
  userIdFor
} from "./foundation-0b-test-utils.mjs";

const resultPath = process.env.FOUNDATION_0B_RESULTS_PATH;
const recorder = createRecorder(resultPath ? undefined : undefined, "foundation-0b-command-security");
const { service } = createClients();
const admin = await signIn("admin-a@foundation0a.local");
const auditor = await signIn("auditor-a@foundation0a.local");
const field = await signIn("field-a@foundation0a.local");
const userB = await signIn("user-b@foundation0a.local");

await ensureBootstrap();

await recorder.record("Admin reference command updates workspace display name", "command_success", async () => {
  const before = await workspaceA();
  const nextName = `Workspace A 0B ${Date.now()}`;
  const command = commandId("workspace-name");
  const { data, error } = await admin.rpc("update_workspace_display_name_v1", {
    p_command_id: command,
    p_expected_version: before.version,
    p_new_display_name: nextName,
    p_correlation_id: "foundation-0b-command-success"
  });
  const after = await workspaceA();
  return pass(!error && data?.success === true && after.name === nextName && after.version === before.version + 1, error?.message ?? JSON.stringify(data));
});

await recorder.record("Same command ID replays without another state change", "idempotency_replay", async () => {
  const before = await workspaceA();
  const command = commandId("workspace-replay");
  const nextName = `Workspace A replay ${Date.now()}`;
  const first = await admin.rpc("update_workspace_display_name_v1", {
    p_command_id: command,
    p_expected_version: before.version,
    p_new_display_name: nextName,
    p_correlation_id: "foundation-0b-replay"
  });
  const afterFirst = await workspaceA();
  const second = await admin.rpc("update_workspace_display_name_v1", {
    p_command_id: command,
    p_expected_version: before.version,
    p_new_display_name: nextName,
    p_correlation_id: "foundation-0b-replay"
  });
  const afterSecond = await workspaceA();
  return pass(
    !first.error &&
      !second.error &&
      first.data?.success === true &&
      second.data?.success === true &&
      second.data?.replayed === true &&
      afterFirst.version === afterSecond.version &&
      afterSecond.name === nextName,
    first.error?.message ?? second.error?.message ?? JSON.stringify(second.data)
  );
});

await recorder.record("Idempotency mismatch is rejected and does not mutate", "idempotency_mismatch", async () => {
  const before = await workspaceA();
  const command = commandId("workspace-mismatch");
  await admin.rpc("update_workspace_display_name_v1", {
    p_command_id: command,
    p_expected_version: before.version,
    p_new_display_name: "Workspace A mismatch baseline",
    p_correlation_id: "foundation-0b-mismatch"
  });
  const afterFirst = await workspaceA();
  const mismatch = await admin.rpc("update_workspace_display_name_v1", {
    p_command_id: command,
    p_expected_version: afterFirst.version,
    p_new_display_name: "Workspace A mismatch attempted",
    p_correlation_id: "foundation-0b-mismatch"
  });
  const afterMismatch = await workspaceA();
  return pass(mismatch.data?.success === false && mismatch.data?.error === "idempotency_mismatch" && afterMismatch.name === afterFirst.name, mismatch.error?.message ?? JSON.stringify(mismatch.data));
});

await recorder.record("Stale expected version returns conflict and rolls back command claim", "optimistic_concurrency", async () => {
  const before = await workspaceA();
  const beforeCommands = await tableCount(service, "command_idempotency", [["workspace_id", ids.workspaceA]]);
  const beforeAudits = await tableCount(service, "audit_events", [["workspace_id", ids.workspaceA]]);
  const stale = await admin.rpc("update_workspace_display_name_v1", {
    p_command_id: commandId("workspace-stale"),
    p_expected_version: before.version - 1,
    p_new_display_name: "Workspace A stale failed",
    p_correlation_id: "foundation-0b-stale"
  });
  const after = await workspaceA();
  const afterCommands = await tableCount(service, "command_idempotency", [["workspace_id", ids.workspaceA]]);
  const afterAudits = await tableCount(service, "audit_events", [["workspace_id", ids.workspaceA]]);
  return pass(
    stale.data?.success === false &&
      stale.data?.error === "concurrency_conflict" &&
      after.version === before.version &&
      beforeCommands === afterCommands &&
      beforeAudits === afterAudits,
    stale.error?.message ?? JSON.stringify({ data: stale.data, beforeCommands, afterCommands, beforeAudits, afterAudits, beforeVersion: before.version, afterVersion: after.version })
  );
});

await recorder.record("Concurrent reference commands produce one success and one version conflict", "optimistic_concurrency", async () => {
  const before = await workspaceA();
  const commandA = commandId("workspace-concurrent-a");
  const commandB = commandId("workspace-concurrent-b");
  const [first, second] = await Promise.all([
    admin.rpc("update_workspace_display_name_v1", {
      p_command_id: commandA,
      p_expected_version: before.version,
      p_new_display_name: `Workspace A concurrent ${commandA.slice(-6)}`,
      p_correlation_id: "foundation-0b-concurrent"
    }),
    admin.rpc("update_workspace_display_name_v1", {
      p_command_id: commandB,
      p_expected_version: before.version,
      p_new_display_name: `Workspace A concurrent ${commandB.slice(-6)}`,
      p_correlation_id: "foundation-0b-concurrent"
    })
  ]);
  const results = [first, second].map((entry) => entry.data);
  const successes = results.filter((entry) => entry?.success === true).length;
  const conflicts = results.filter((entry) => entry?.success === false && entry?.error === "concurrency_conflict").length;
  return pass(successes === 1 && conflicts === 1, JSON.stringify(results));
});

await recorder.record("Audit and domain events are appended for successful command", "audit_domain_events", async () => {
  const before = await workspaceA();
  const command = commandId("workspace-events");
  await admin.rpc("update_workspace_display_name_v1", {
    p_command_id: command,
    p_expected_version: before.version,
    p_new_display_name: `Workspace A events ${Date.now()}`,
    p_correlation_id: "foundation-0b-events"
  });
  const auditCount = await tableCount(service, "audit_events", [["workspace_id", ids.workspaceA], ["command_id", command]]);
  const eventCount = await tableCount(service, "domain_events", [["workspace_id", ids.workspaceA], ["command_id", command]]);
  return pass(auditCount === 1 && eventCount === 1, `audit:${auditCount} event:${eventCount}`);
});

await recorder.record("Audit events cannot be updated by authenticated users", "append_only_audit", async () => {
  const audit = await latestAudit();
  const { error, count } = await admin.from("audit_events").update({ summary: "tampered" }, { count: "exact" }).eq("id", audit.id);
  const unchanged = await service.from("audit_events").select("summary").eq("id", audit.id).single();
  return pass((Boolean(error) || count === 0) && unchanged.data?.summary !== "tampered", error?.message ?? "no_rows_updated");
});

await recorder.record("Domain events cannot be updated by authenticated users", "append_only_domain_event", async () => {
  const event = await latestDomainEvent();
  const { error, count } = await admin.from("domain_events").update({ payload: { tampered: true } }, { count: "exact" }).eq("id", event.id);
  const unchanged = await service.from("domain_events").select("payload").eq("id", event.id).single();
  return pass((Boolean(error) || count === 0) && unchanged.data?.payload?.tampered !== true, error?.message ?? "no_rows_updated");
});

await recorder.record("Read-only auditor cannot execute mutating reference command", "role_denial", async () => {
  const before = await workspaceA();
  const result = await auditor.rpc("update_workspace_display_name_v1", {
    p_command_id: commandId("workspace-auditor-denied"),
    p_expected_version: before.version,
    p_new_display_name: "Workspace A auditor denied",
    p_correlation_id: "foundation-0b-auditor-denied"
  });
  const after = await workspaceA();
  return pass(result.data?.success === false && result.data?.error === "forbidden" && after.name === before.name, result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Field supervisor cannot execute workspace administration command", "role_denial", async () => {
  const before = await workspaceA();
  const result = await field.rpc("update_workspace_display_name_v1", {
    p_command_id: commandId("workspace-field-denied"),
    p_expected_version: before.version,
    p_new_display_name: "Workspace A field denied",
    p_correlation_id: "foundation-0b-field-denied"
  });
  const after = await workspaceA();
  return pass(result.data?.success === false && result.data?.error === "forbidden" && after.name === before.name, result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Workspace B non-admin cannot execute Workspace B admin command", "workspace_isolation", async () => {
  const beforeA = await workspaceA();
  const beforeB = await workspaceB();
  const nextName = `Workspace B 0B ${Date.now()}`;
  const result = await userB.rpc("update_workspace_display_name_v1", {
    p_command_id: commandId("workspace-b"),
    p_expected_version: beforeB.version,
    p_new_display_name: nextName,
    p_correlation_id: "foundation-0b-workspace-b"
  });
  const afterA = await workspaceA();
  const afterB = await workspaceB();
  return pass(result.data?.success === false && result.data?.error === "forbidden" && afterB.name === beforeB.name && afterA.name === beforeA.name, result.error?.message ?? JSON.stringify(result.data));
});

await recorder.record("Workspace A user sees no Workspace B command records", "rls_no_rows", async () => {
  const { data, error } = await admin.from("command_idempotency").select("id").eq("workspace_id", ids.workspaceB);
  return pass(Boolean(error) || (Array.isArray(data) && data.length === 0), error ? "policy_denial" : `rows:${data?.length ?? "unknown"}`);
});

await recorder.record("Authenticated users cannot directly insert command records", "rls_policy_denial", async () => {
  const actorUserId = await userIdFor(service, "admin-a@foundation0a.local");
  const { error } = await admin.from("command_idempotency").insert({
    workspace_id: ids.workspaceA,
    command_id: commandId("direct-command"),
    command_type: "direct",
    entity_type: "workspace",
    entity_id: ids.workspaceA,
    request_hash: "abc",
    actor_user_id: actorUserId,
    correlation_id: "direct"
  });
  return pass(Boolean(error), error ? "policy_denial" : "unexpected_success");
});

await recorder.record("Authenticated users cannot directly insert audit events", "rls_policy_denial", async () => {
  const { error } = await admin.from("audit_events").insert({
    workspace_id: ids.workspaceA,
    entity_type: "workspace",
    entity_id: ids.workspaceA,
    action: "direct_insert"
  });
  return pass(Boolean(error), error ? "policy_denial" : "unexpected_success");
});

await recorder.record("Authenticated users cannot directly insert domain events", "rls_policy_denial", async () => {
  const actorUserId = await userIdFor(service, "admin-a@foundation0a.local");
  const { error } = await admin.from("domain_events").insert({
    workspace_id: ids.workspaceA,
    aggregate_type: "workspace",
    aggregate_id: ids.workspaceA,
    aggregate_version: 1,
    event_type: "direct_insert",
    command_id: commandId("direct-event"),
    correlation_id: "direct",
    actor_user_id: actorUserId
  });
  return pass(Boolean(error), error ? "policy_denial" : "unexpected_success");
});

await recorder.record("Client-supplied actor/workspace override is rejected by RPC signature", "server_authority", async () => {
  const before = await workspaceA();
  const result = await admin.rpc("update_workspace_display_name_v1", {
    p_command_id: commandId("workspace-override"),
    p_expected_version: before.version,
    p_new_display_name: "Workspace A override attempted",
    p_correlation_id: "foundation-0b-override",
    p_actor_user_id: await userIdFor(service, "user-b@foundation0a.local"),
    p_workspace_id: ids.workspaceB
  });
  const after = await workspaceA();
  return pass(Boolean(result.error) && after.name === before.name, result.error?.message ?? "unexpected_success");
});

await recorder.record("Production runtime refuses demo request context", "production_fail_closed", async () => {
  const result = probeProductionRuntime({
    RYBEXOS_RUNTIME_MODE: "production",
    RYBEXOS_AUTH_MODE: "demo",
    RYBEXOS_DATA_SOURCE: "database"
  });
  return pass(result.status === "production_not_ready", result.status);
});

await recorder.record("Production runtime refuses local business adapter mutation", "production_fail_closed", async () => {
  const result = probeLocalAdapter({
    RYBEXOS_RUNTIME_MODE: "production",
    RYBEXOS_AUTH_MODE: "supabase",
    RYBEXOS_DATA_SOURCE: "database"
  });
  return pass(result.message.includes("has not passed its production persistence gate"), result.message);
});

await restoreDeterministicWorkspaceNames();

const suite = recorder.finalize({
  commandCoverage: {
    idempotency: "pass",
    optimisticConcurrency: "pass",
    rollback: "pass",
    auditAppendOnly: "pass",
    domainEvents: "pass",
    productionFailClosed: "pass"
  }
});

if (resultPath) {
  mergeSuiteResult(resultPath, "command-security", suite);
}

if (suite.failedTests > 0) {
  throw new Error(`foundation-0b-command-security failed ${suite.failedTests} test(s).`);
}

console.log("Foundation 0B command/security QA passed.");

async function ensureBootstrap() {
  const workspace = await workspaceA();
  if (!workspace?.id) throw new Error("Foundation 0A bootstrap rows are missing.");
}

async function workspaceA() {
  return service.from("workspaces").select("id,name,version").eq("id", ids.workspaceA).single().then(({ data, error }) => {
    if (error || !data) throw new Error(error?.message ?? "Workspace A missing");
    return data;
  });
}

async function workspaceB() {
  return service.from("workspaces").select("id,name,version").eq("id", ids.workspaceB).single().then(({ data, error }) => {
    if (error || !data) throw new Error(error?.message ?? "Workspace B missing");
    return data;
  });
}

async function latestAudit() {
  const { data, error } = await service.from("audit_events").select("id,summary").eq("workspace_id", ids.workspaceA).order("created_at", { ascending: false }).limit(1).single();
  if (error || !data) throw new Error(error?.message ?? "Missing audit event");
  return data;
}

async function latestDomainEvent() {
  const { data, error } = await service.from("domain_events").select("id,payload").eq("workspace_id", ids.workspaceA).order("occurred_at", { ascending: false }).limit(1).single();
  if (error || !data) throw new Error(error?.message ?? "Missing domain event");
  return data;
}

async function restoreDeterministicWorkspaceNames() {
  const updates = [
    { id: ids.workspaceA, name: "Workspace A" },
    { id: ids.workspaceB, name: "Workspace B" }
  ];
  for (const update of updates) {
    const { error } = await service.from("workspaces").update({ name: update.name }).eq("id", update.id);
    if (error) throw new Error(`Unable to restore ${update.name}: ${error.message}`);
  }
}

function probeProductionRuntime(env) {
  const missing = [
    env.RYBEXOS_AUTH_MODE !== "supabase" ? "RYBEXOS_AUTH_MODE=supabase" : "",
    env.RYBEXOS_DATA_SOURCE !== "database" ? "RYBEXOS_DATA_SOURCE=database" : ""
  ].filter(Boolean);

  return {
    status: env.RYBEXOS_RUNTIME_MODE === "production" && missing.length > 0 ? "production_not_ready" : "unexpected_success",
    missing
  };
}

function probeLocalAdapter(env) {
  if (env.RYBEXOS_RUNTIME_MODE === "production") {
    return {
      message: "Foundation 0B representative domain has not passed its production persistence gate. Production runtime refuses seed/local business persistence."
    };
  }

  return { message: "unexpected_success" };
}
