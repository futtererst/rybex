import "server-only";
import webPush, { type PushSubscription } from "web-push";
import { emailConfigured, pushConfigured, smsConfigured } from "./notification-settings";

async function providerResponse(response: Response, provider: string) {
  if (!response.ok) throw new Error(`${provider} rejected delivery (${response.status}).`);
  return response;
}
export async function sendScheduleEmail(to: string, idempotencyKey: string, kind: "changed" | "cancelled") {
  if (!emailConfigured()) throw new Error("Email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${process.env.D5O_RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: process.env.D5O_EMAIL_FROM, to: [to], subject: kind === "cancelled" ? "D5O crew booking cancelled" : "D5O crew schedule updated",
      text: kind === "cancelled" ? "A crew booking assigned to you was removed. Sign in to D5O and open My crew schedule to review your current bookings."
        : "A crew booking was added or changed for you. Sign in to D5O and open My crew schedule to review the date, shift, site and work package, then accept or decline. A booking does not authorize work release." }) });
  await providerResponse(response, "Email provider");
}
async function twilioRequest(url: string, parameters: URLSearchParams) {
  const account = process.env.D5O_TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.D5O_TWILIO_AUTH_TOKEN ?? "";
  const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Basic ${Buffer.from(`${account}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: parameters });
  await providerResponse(response, "SMS provider");
  return response.json() as Promise<{ status?: string }>;
}
export async function sendScheduleSms(to: string, kind: "changed" | "cancelled") {
  if (!smsConfigured()) throw new Error("SMS delivery is not configured.");
  const account = process.env.D5O_TWILIO_ACCOUNT_SID;
  const params = new URLSearchParams({ To: to, Body: kind === "cancelled" ? "D5O: a crew booking assigned to you was cancelled. Sign in to My crew schedule to review your current plan."
    : "D5O: a crew booking was added or changed. Sign in to My crew schedule to review and accept or decline. Booking is not work release." });
  if (process.env.D5O_TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", process.env.D5O_TWILIO_MESSAGING_SERVICE_SID);
  else params.set("From", process.env.D5O_TWILIO_FROM ?? "");
  await twilioRequest(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, params);
}
export async function sendSchedulePush(subscription: PushSubscription, kind: "changed" | "cancelled") {
  if (!pushConfigured()) throw new Error("Push delivery is not configured.");
  webPush.setVapidDetails(process.env.D5O_VAPID_SUBJECT!, process.env.D5O_VAPID_PUBLIC_KEY!, process.env.D5O_VAPID_PRIVATE_KEY!);
  await webPush.sendNotification(subscription, JSON.stringify({ title: kind === "cancelled" ? "Crew booking cancelled" : "Crew schedule updated",
    body: kind === "cancelled" ? "Sign in to review your current bookings." : "Sign in to review and respond to your booking.", url: "/work/my-schedule" }), { TTL: 86400 });
}
