import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const file = process.env.D5O_PILOT_CREDENTIALS_FILE;
if (process.env.D5O_ISOLATED_PILOT !== "1" || url !== "http://127.0.0.1:56321"
  || !anon || !secret || !file) throw new Error("disposable_pilot_only");
const credentials = JSON.parse(readFileSync(file, "utf8"));
const adminIdentity = credentials.users.find((item) => item.key === "admin");
const worker = credentials.users.find((item) => item.key === "worker");
if (!adminIdentity || !worker) throw new Error("pilot_users_missing");
const admin = createClient(url, secret, { auth: { persistSession: false } });
const session = createClient(url, anon, { auth: { persistSession: false } });
const { error: loginError } = await session.auth.signInWithPassword({
  email: adminIdentity.email, password: adminIdentity.password });
if (loginError) throw loginError;
const { data: actor, error: actorError } = await session.rpc("d5o_hosted_actor_v1",
  { p_workspace_key: "rybex" });
if (actorError || actor.role !== "admin") throw new Error("pilot_admin_required");
let second = credentials.users.find((item) => item.key === "worker2");
if (!second) {
  const email = "d5o-pilot-worker2@example.test";
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password,
    email_confirm: true, user_metadata: { display_name: "Avery Reed" } });
  if (error || !data.user) throw new Error(`second_worker_creation_failed:${error?.message}`);
  second = { key: "worker2", role: "field_worker", name: "Avery Reed",
    email, password, userId: data.user.id };
  credentials.users.push(second);
  const temporary = `${file}.crew.tmp`;
  writeFileSync(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { flag: "wx" });
  renameSync(temporary, file);
}
const { error: bindingError } = await admin.rpc("d5o_hosted_bind_worker_v1", {
  p_workspace_key: "rybex", p_admin_user_id: adminIdentity.userId,
  p_admin_membership_id: actor.membershipId,
  p_worker_email: second.email, p_person: "Avery Reed"
});
if (bindingError) throw new Error(`second_worker_binding_failed:${bindingError.code}`);
let serviceWorker = credentials.users.find((item) => item.key === "serviceWorker");
if (!serviceWorker) {
  const email = "d5o-pilot-service-worker@example.test";
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password,
    email_confirm: true, user_metadata: { display_name: "Jordan Lee" } });
  if (error || !data.user) throw new Error(`service_worker_creation_failed:${error?.message}`);
  serviceWorker = { key: "serviceWorker", role: "field_worker", name: "Jordan Lee",
    email, password, userId: data.user.id };
  credentials.users.push(serviceWorker);
  const temporary = `${file}.service-crew.tmp`;
  writeFileSync(temporary, `${JSON.stringify(credentials, null, 2)}\n`, { flag: "wx" });
  renameSync(temporary, file);
}
const { error: serviceBindingError } = await admin.rpc("d5o_hosted_bind_worker_v1", {
  p_workspace_key: "rybex", p_admin_user_id: adminIdentity.userId,
  p_admin_membership_id: actor.membershipId,
  p_worker_email: serviceWorker.email, p_person: "Jordan Lee"
});
if (serviceBindingError) throw new Error(`service_worker_binding_failed:${serviceBindingError.code}`);
for (const person of ["Nate Walker", "Avery Reed"]) {
  const { error } = await session.rpc("d5o_hosted_crew_profile_command_v1", {
    p_workspace_key: "rybex", p_person: person,
    p_qualifications: ["Fiber installation"],
    p_weekly_capacity_hours: 40,
    p_command_id: `connected-pilot-fiber-profile-${person.replaceAll(" ", "-").toLowerCase()}-v1`
  });
  if (error) throw new Error(`crew_profile_failed:${person}:${error.code}:${error.message}`);
}
const { error: serviceProfileError } = await session.rpc("d5o_hosted_crew_profile_command_v1", {
  p_workspace_key: "rybex", p_person: "Jordan Lee",
  p_qualifications: ["Network cabling", "Controls service"],
  p_weekly_capacity_hours: 40,
  p_command_id: "connected-pilot-controls-profile-jordan-lee-v1"
});
if (serviceProfileError) throw new Error(`service_profile_failed:${serviceProfileError.code}`);
console.log(JSON.stringify({ status: "two_bound_qualified_pilot_workers",
  people: ["Nate Walker", "Avery Reed", "Jordan Lee"], credentialsStoredOutsideRepo: true }));
