import "server-only";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Assignment, PublishedSchedule, SharedSchedule, WorkspaceKey } from "@/components/d5o/platform/schedule-model";
import { createRybexSupabaseAdminClient } from "@/lib/d5o/auth/supabase-server";
import { crewUserForPerson, scheduleWorkspaceKeys } from "./crew-identity";
import { loadNotificationSettings, validExternalEmail, validPhone, type Channel } from "./notification-settings";
import { sendScheduleEmail, sendSchedulePush, sendScheduleSms } from "./notification-providers";

export type DeliveryRecord = { id: string; workspace: WorkspaceKey; userId: string; recipient: string; publicationId: string;
  assignmentId: string; kind: "changed" | "cancelled"; channel: Channel; state: "attempting" | "sent" | "failed"; attemptedAt: string; completedAt?: string; error?: string };
const root = path.join(process.cwd(), ".rybexos-local", "d5o-notification-outbox-v1");
const fileFor = (workspace: WorkspaceKey) => path.join(root, `${workspace}.json`);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function locked<T>(workspace: WorkspaceKey, action: () => Promise<T>) {
  await mkdir(root, { recursive: true });
  const lock = `${fileFor(workspace)}.lock`;
  for (let attempt = 0; attempt < 40; attempt++) {
    let handle;
    try { handle = await open(lock, "wx"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; await wait(20 + attempt * 5); continue; }
    try { return await action(); }
    finally { await handle.close(); await rm(lock, { force: true }); }
  }
  throw new Error("Notification outbox is busy.");
}
async function readUnlocked(workspace: WorkspaceKey): Promise<DeliveryRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(fileFor(workspace), "utf8")) as DeliveryRecord[];
    if (!Array.isArray(parsed) || parsed.some((item) => item.workspace !== workspace || !item.id || !["attempting", "sent", "failed"].includes(item.state)))
      throw new Error("Notification outbox requires administrator review.");
    return parsed;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
async function writeUnlocked(workspace: WorkspaceKey, records: DeliveryRecord[]) {
  const target = fileFor(workspace);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try { await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, { flag: "wx", mode: 0o600 }); await rename(temporary, target); }
  finally { await rm(temporary, { force: true }).catch(() => undefined); }
}
export async function deliveryRecords(workspace: WorkspaceKey, userId?: string) {
  return locked(workspace, async () => (await readUnlocked(workspace)).filter((item) => !userId || item.userId === userId));
}
export async function deliverySummary(workspace: WorkspaceKey, publicationId?: string) {
  const records = (await deliveryRecords(workspace)).filter((item) => !publicationId || item.publicationId === publicationId);
  return { sent: records.filter((item) => item.state === "sent").length, failed: records.filter((item) => item.state === "failed").length,
    attempting: records.filter((item) => item.state === "attempting").length };
}
function unchangedForRecipient(assignment: Assignment, recipient: string, previous?: PublishedSchedule) {
  const prior = previous?.assignments.find((item) => item.id === assignment.id && item.people.includes(recipient));
  return Boolean(prior && prior.crew === assignment.crew && prior.workId === assignment.workId && prior.packageId === assignment.packageId
    && prior.date === assignment.date && prior.shift === assignment.shift && prior.people.length === assignment.people.length
    && prior.people.every((person, index) => person === assignment.people[index]));
}
function deliveryId(publicationId: string, assignmentId: string, userId: string, channel: Channel) {
  return createHash("sha256").update([publicationId, assignmentId, userId, channel].join("\0")).digest("hex");
}
async function claim(record: DeliveryRecord) {
  return locked(record.workspace, async () => {
    const existing = await readUnlocked(record.workspace);
    if (existing.some((item) => item.id === record.id)) return false;
    existing.push(record);
    await writeUnlocked(record.workspace, existing);
    return true;
  });
}
async function finish(record: DeliveryRecord, state: "sent" | "failed", error?: string) {
  await locked(record.workspace, async () => {
    const records = await readUnlocked(record.workspace);
    const item = records.find((entry) => entry.id === record.id);
    if (!item || item.state !== "attempting") return;
    item.state = state; item.completedAt = new Date().toISOString(); item.error = error;
    await writeUnlocked(record.workspace, records);
  });
}
/** Published bookings remain authoritative even if an optional external channel fails. */
export async function deliverPublicationChanges(state: SharedSchedule, publication: PublishedSchedule) {
  const previous = state.publications.filter((item) => item.week === publication.week && item.id !== publication.id)
    .filter((item) => Date.parse(item.publishedAt) <= Date.parse(publication.publishedAt)).at(-1);
  const changed = publication.assignments.flatMap((assignment) => assignment.people.map((recipient) => ({ assignment, recipient, kind: "changed" as const })))
    .filter(({ assignment, recipient }) => !unchangedForRecipient(assignment, recipient, previous));
  const cancelled = previous?.assignments.flatMap((assignment) => assignment.people
    .filter((recipient) => !publication.assignments.some((current) => current.id === assignment.id && current.people.includes(recipient)))
    .map((recipient) => ({ assignment, recipient, kind: "cancelled" as const }))) ?? [];
  const tasks = [...changed, ...cancelled];
  const results = await Promise.allSettled(tasks.map(async ({ assignment, recipient, kind }) => {
    const userId = await crewUserForPerson(state.workspace, recipient);
    if (!userId) return; // In-app booking remains visible; no inferred external recipient.
    const settings = await loadNotificationSettings(userId);
    if (!settings.channels.email && !settings.channels.sms && !settings.channels.push) return;
    const workspaceIds = Object.entries(scheduleWorkspaceKeys).filter(([, key]) => key === state.workspace).map(([id]) => id);
    if (workspaceIds.length !== 1) return;
    const admin = createRybexSupabaseAdminClient();
    const [membership, profile] = await Promise.all([
      admin.from("workspace_memberships").select("id").eq("user_id", userId).eq("workspace_id", workspaceIds[0]).eq("status", "active").limit(2),
      admin.from("user_profiles").select("status").eq("user_id", userId).limit(2)
    ]);
    const profileRows = profile.data as unknown as { status: string }[] | null;
    if (membership.error || membership.data?.length !== 1 || profile.error || profileRows?.length !== 1 || profileRows[0].status !== "active") return;
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return;
    const authUser = data.user;
    const verifiedEmail = authUser.email_confirmed_at && authUser.email && validExternalEmail(authUser.email) ? authUser.email.toLowerCase() : "";
    const verifiedPhone = authUser.phone_confirmed_at && authUser.phone && validPhone(authUser.phone) ? authUser.phone : "";
    const channelResults = await Promise.allSettled((["email", "sms", "push"] as Channel[]).map(async (channel) => {
      const enabledAt = settings.enabledAt[channel];
      if (!settings.channels[channel] || !enabledAt || Date.parse(publication.publishedAt) < Date.parse(enabledAt)) return;
      if (channel === "email" && (!settings.email || !settings.emailVerifiedAt || settings.email !== verifiedEmail)) return;
      if (channel === "sms" && (!settings.phone || !settings.phoneVerifiedAt || settings.phone !== verifiedPhone)) return;
      if (channel === "push" && !settings.pushSubscription) return;
      const id = deliveryId(publication.id, assignment.id, userId, channel);
      const record: DeliveryRecord = { id, workspace: state.workspace, userId, recipient, publicationId: publication.id,
        assignmentId: assignment.id, kind, channel, state: "attempting", attemptedAt: new Date().toISOString() };
      if (!(await claim(record))) return;
      try {
        if (channel === "email") await sendScheduleEmail(settings.email!, id, kind);
        else if (channel === "sms") await sendScheduleSms(settings.phone!, kind);
        else await sendSchedulePush(settings.pushSubscription!, kind);
        await finish(record, "sent");
      } catch (error) { await finish(record, "failed", error instanceof Error ? error.message.slice(0, 180) : "Provider unavailable."); }
    }));
    if (channelResults.some((result) => result.status === "rejected")) throw new Error("Notification outbox could not record every channel result.");
  }));
  if (results.some((result) => result.status === "rejected")) throw new Error("Some external notification intents could not be recorded.");
}
