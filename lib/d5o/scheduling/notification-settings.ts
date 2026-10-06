import "server-only";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PushSubscription as WebPushSubscription } from "web-push";
import type { WorkspaceKey } from "@/components/d5o/platform/schedule-model";

const root = path.join(process.cwd(), ".rybexos-local", "d5o-notification-settings-v2");
const legacyRoot = path.join(process.cwd(), ".rybexos-local", "d5o-notification-settings-v1");
const key = (userId: string) => createHash("sha256").update(userId).digest("hex");
const fileFor = (userId: string) => path.join(root, `${key(userId)}.json`);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export type Channel = "email" | "sms" | "push";
export type NotificationSettings = {
  schemaVersion: 2; userId: string;
  legacyPreferencesNeedReview?: boolean;
  channels: Record<Channel, boolean>; enabledAt: Partial<Record<Channel, string>>;
  email?: string; emailVerifiedAt?: string;
  phone?: string; phoneVerifiedAt?: string;
  pushSubscription?: WebPushSubscription;
};
type LegacyNotificationSettings = Omit<NotificationSettings, "schemaVersion"> & { schemaVersion: 1; workspace: WorkspaceKey };
const initial = (userId: string): NotificationSettings => ({
  schemaVersion: 2, userId, channels: { email: false, sms: false, push: false }, enabledAt: {}
});

async function locked<T>(userId: string, action: () => Promise<T>): Promise<T> {
  await mkdir(root, { recursive: true });
  const lock = `${fileFor(userId)}.lock`;
  for (let attempt = 0; attempt < 40; attempt++) {
    let handle;
    try { handle = await open(lock, "wx"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; await pause(20 + 5 * attempt); continue; }
    try { return await action(); }
    finally { await handle.close(); await rm(lock, { force: true }); }
  }
  throw new Error("Notification settings are busy. Retry shortly.");
}
async function readUnlocked(userId: string) {
  let raw: string;
  try { raw = await readFile(fileFor(userId), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return readLegacy(userId); throw error; }
  const value = JSON.parse(raw) as NotificationSettings;
  if (value.schemaVersion !== 2 || value.userId !== userId
    || typeof value.channels?.email !== "boolean" || typeof value.channels?.sms !== "boolean" || typeof value.channels?.push !== "boolean")
    throw new Error("Notification settings require administrator review.");
  return value;
}
async function readLegacy(userId: string): Promise<NotificationSettings> {
  const hash = key(userId);
  let found = false;
  for (const workspace of ["rybex", "rotork"] as WorkspaceKey[]) {
    let raw: string;
    try { raw = await readFile(path.join(legacyRoot, `${workspace}-${hash}.json`), "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    const value = JSON.parse(raw) as LegacyNotificationSettings;
    if (value.schemaVersion !== 1 || value.workspace !== workspace || value.userId !== userId
      || typeof value.channels?.email !== "boolean" || typeof value.channels?.sms !== "boolean" || typeof value.channels?.push !== "boolean")
      throw new Error("Legacy notification settings require administrator review.");
    found = true;
  }
  // A workspace-specific opt-in cannot silently become consent for every workspace.
  return { ...initial(userId), legacyPreferencesNeedReview: found };
}
async function writeUnlocked(userId: string, value: NotificationSettings) {
  const target = fileFor(userId);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try { await writeFile(temporary, `${JSON.stringify({ ...value, legacyPreferencesNeedReview: undefined }, null, 2)}\n`, { flag: "wx", mode: 0o600 }); await rename(temporary, target); }
  finally { await rm(temporary, { force: true }).catch(() => undefined); }
}
export async function loadNotificationSettings(userId: string) {
  return locked(userId, () => readUnlocked(userId));
}
export async function updateNotificationSettings(userId: string, change: (current: NotificationSettings) => NotificationSettings) {
  return locked(userId, async () => {
    const next = change(await readUnlocked(userId));
    await writeUnlocked(userId, next);
    return next;
  });
}
export function publicNotificationSettings(value: NotificationSettings) {
  return { channels: value.channels, email: value.email ?? "", emailVerified: Boolean(value.email && value.emailVerifiedAt),
    phone: value.phone ?? "", phoneVerified: Boolean(value.phone && value.phoneVerifiedAt),
    pushRegistered: Boolean(value.pushSubscription), legacyPreferencesNeedReview: Boolean(value.legacyPreferencesNeedReview) };
}
export function emailConfigured() { return Boolean(process.env.D5O_RESEND_API_KEY && process.env.D5O_EMAIL_FROM); }
export function smsConfigured() { return Boolean(process.env.D5O_TWILIO_ACCOUNT_SID && process.env.D5O_TWILIO_AUTH_TOKEN
  && (process.env.D5O_TWILIO_MESSAGING_SERVICE_SID || process.env.D5O_TWILIO_FROM)); }
export function pushConfigured() { return Boolean(process.env.D5O_VAPID_PUBLIC_KEY && process.env.D5O_VAPID_PRIVATE_KEY && process.env.D5O_VAPID_SUBJECT); }
export function channelAvailability() { return { email: emailConfigured(), sms: smsConfigured(), push: pushConfigured() }; }
export function validExternalEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/\.(local|invalid|test|example)$/i.test(value) && value.length <= 254; }
export function validPhone(value: string) { return /^\+[1-9]\d{7,14}$/.test(value); }
/** Restrict user-supplied push endpoints to recognized browser push services. */
export function validPushSubscription(value: unknown): value is WebPushSubscription {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WebPushSubscription>;
  if (typeof item.endpoint !== "string" || item.endpoint.length > 2048 || !item.keys
    || !/^[A-Za-z0-9_-]{40,120}$/.test(item.keys.p256dh ?? "") || !/^[A-Za-z0-9_-]{15,40}$/.test(item.keys.auth ?? "")) return false;
  try {
    const url = new URL(item.endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "wns2-by3p.notify.windows.com"].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch { return false; }
}
