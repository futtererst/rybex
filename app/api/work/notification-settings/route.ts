import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import { scheduleWorkspaceKeys } from "@/lib/d5o/scheduling/crew-identity";
import { validLocalScheduleOrigin } from "@/lib/d5o/scheduling/request-origin";
import { deliveryRecords } from "@/lib/d5o/scheduling/notification-delivery";
import { channelAvailability, loadNotificationSettings, publicNotificationSettings, updateNotificationSettings,
  validExternalEmail, validPhone, validPushSubscription, type Channel } from "@/lib/d5o/scheduling/notification-settings";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function scope() {
  assertProofEnvironment();
  const context = await getRequestContext();
  const workspace = context.status === "authorized" && context.workspace && context.membership?.status === "active"
    ? scheduleWorkspaceKeys[context.workspace.id] : undefined;
  const userId = context.user?.id;
  if (!workspace || !userId) return { context, workspace: undefined, userId: undefined, contacts: { email: "", phone: "" } };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error("Authenticated identity changed.");
  const user = data.user;
  return { context, workspace, userId, contacts: {
    email: user.email_confirmed_at && user.email && validExternalEmail(user.email) ? user.email.toLowerCase() : "",
    phone: user.phone_confirmed_at && user.phone && validPhone(user.phone) ? user.phone : ""
  } };
}
async function view(workspace: "rybex" | "rotork", userId: string, contacts: { email: string; phone: string }) {
  const settings = await loadNotificationSettings(userId);
  const deliveries = (await deliveryRecords(workspace, userId)).slice(-12).reverse().map(({ channel, kind, state, attemptedAt, completedAt, error }) =>
    ({ channel, kind, state, attemptedAt, completedAt, error }));
  return { workspace, settings: publicNotificationSettings(settings), verifiedAccountContacts: contacts,
    available: channelAvailability(), vapidPublicKey: process.env.D5O_VAPID_PUBLIC_KEY ?? "", deliveries };
}
export async function GET() {
  try {
    const { context, workspace, userId, contacts } = await scope();
    if (!workspace || !userId) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    return reply(await view(workspace, userId, contacts));
  } catch { return reply({ error: "settings_unavailable" }, 500); }
}
type Action = { action: string; [key: string]: unknown };
export async function POST(request: NextRequest) {
  try {
    const { context, workspace, userId, contacts } = await scope();
    if (!workspace || !userId) return reply({ error: "unauthorized" }, context.authenticated ? 403 : 401);
    if (!validLocalScheduleOrigin(request.headers)) return reply({ error: "invalid_origin" }, 403);
    const input = await request.json() as Action;
    const settings = await loadNotificationSettings(userId);
    if (input.action === "set-channels") {
      if (!input.channels || typeof input.channels !== "object") return reply({ error: "invalid_channels" }, 400);
      const channels = input.channels as Record<Channel, unknown>;
      if (["email", "sms", "push"].some((channel) => typeof channels[channel as Channel] !== "boolean")) return reply({ error: "invalid_channels" }, 400);
      const available = channelAvailability();
      if ((channels.email && !settings.channels.email && (!available.email || !contacts.email))
        || (channels.sms && !settings.channels.sms && (!available.sms || !contacts.phone))
        || (channels.push && !settings.channels.push && (!available.push || !settings.pushSubscription))) return reply({ error: "verified_destination_required" }, 409);
      await updateNotificationSettings(userId, (current) => {
        const next = { ...current, channels: { email: channels.email as boolean, sms: channels.sms as boolean, push: channels.push as boolean },
          enabledAt: { ...current.enabledAt } };
        for (const channel of ["email", "sms", "push"] as Channel[]) if (next.channels[channel] && !current.channels[channel]) {
          next.enabledAt[channel] = new Date().toISOString();
          if (channel === "email") { next.email = contacts.email; next.emailVerifiedAt = new Date().toISOString(); }
          if (channel === "sms") { next.phone = contacts.phone; next.phoneVerifiedAt = new Date().toISOString(); }
        }
        return next;
      });
    } else if (input.action === "save-push") {
      if (!channelAvailability().push || !validPushSubscription(input.subscription)) return reply({ error: "invalid_push_subscription" }, 400);
      const subscription = input.subscription;
      await updateNotificationSettings(userId, (current) => ({ ...current, pushSubscription: {
        endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
      } }));
    } else if (input.action === "remove-push") {
      await updateNotificationSettings(userId, (current) => ({ ...current, pushSubscription: undefined,
        channels: { ...current.channels, push: false } }));
    } else return reply({ error: "invalid_action" }, 400);
    return reply(await view(workspace, userId, contacts));
  } catch (error) { return reply({ error: "settings_update_failed", message: error instanceof Error ? error.message : "Settings could not be saved." }, 500); }
}
