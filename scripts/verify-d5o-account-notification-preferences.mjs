import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { loadNotificationSettings, updateNotificationSettings } = await import(pathToFileURL(path.resolve("lib/d5o/scheduling/notification-settings.ts")).href);
const root = path.resolve(".rybexos-local");
const user = `preference-test-${randomUUID()}`;
const conflict = `preference-test-${randomUUID()}`;
const hash = (id) => createHash("sha256").update(id).digest("hex");
const globalFile = (id) => path.join(root, "d5o-notification-settings-v2", `${hash(id)}.json`);
const legacyFile = (id, workspace) => path.join(root, "d5o-notification-settings-v1", `${workspace}-${hash(id)}.json`);
try {
  const defaults = await loadNotificationSettings(user);
  assert.deepEqual(defaults.channels, { email: false, sms: false, push: false });
  await updateNotificationSettings(user, (current) => ({ ...current, channels: { ...current.channels, push: true }, enabledAt: { push: "2026-10-04T00:00:00.000Z" } }));
  assert.equal((await loadNotificationSettings(user)).channels.push, true);
  const stored = JSON.parse(await readFile(globalFile(user), "utf8"));
  assert.equal(stored.userId, user);
  assert.equal(stored.workspace, undefined, "The account preference must have no workspace key");
  assert.equal(stored.channels.push, true);

  await mkdir(path.dirname(legacyFile(conflict, "rybex")), { recursive: true });
  for (const [workspace, push] of [["rybex", true], ["rotork", false]]) {
    await writeFile(legacyFile(conflict, workspace), JSON.stringify({ schemaVersion: 1, workspace, userId: conflict,
      channels: { email: false, sms: false, push }, enabledAt: {} }));
  }
  const needsReview = await loadNotificationSettings(conflict);
  assert.equal(needsReview.legacyPreferencesNeedReview, true);
  assert.deepEqual(needsReview.channels, { email: false, sms: false, push: false }, "Older workspace opt-ins do not expand silently");
  await assert.rejects(() => readFile(globalFile(conflict), "utf8"), { code: "ENOENT" }, "Loading older settings does not create an account-wide opt-in");
  await updateNotificationSettings(conflict, (current) => ({ ...current, channels: { ...current.channels, push: true } }));
  assert.equal((await loadNotificationSettings(conflict)).channels.push, true, "An explicit account choice applies after reconfirmation");
  assert.equal((await loadNotificationSettings(conflict)).legacyPreferencesNeedReview, undefined);
  assert.equal((await readFile(legacyFile(conflict, "rybex"), "utf8")).includes('"push":true'), true,
    "Conflicting legacy preferences remain preserved");
  console.log("Account notification preferences: PASS — one user key, durable choices, old workspace opt-ins paused until explicit account choice.");
} finally {
  await Promise.all([globalFile(user), globalFile(conflict), legacyFile(conflict, "rybex"), legacyFile(conflict, "rotork")].map((file) => rm(file, { force: true })));
}
