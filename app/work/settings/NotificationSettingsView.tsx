"use client";

import { useCallback, useEffect, useState } from "react";

type Channel = "email" | "sms" | "push";
type View = { workspace: "rybex" | "rotork"; settings: { channels: Record<Channel, boolean>; email: string; emailVerified: boolean;
  legacyPreferencesNeedReview: boolean;
  phone: string; phoneVerified: boolean; pushRegistered: boolean }; verifiedAccountContacts: { email: string; phone: string };
  available: Record<Channel, boolean>; vapidPublicKey: string;
  deliveries: { channel: Channel; kind: "changed" | "cancelled"; state: "attempting" | "sent" | "failed"; attemptedAt: string; completedAt?: string; error?: string }[] };
function decodeKey(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
export function NotificationSettingsView() {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/work/notification-settings", { cache: "no-store" });
    if (!response.ok) throw new Error("Notification preferences could not be loaded for your account.");
    const result = await response.json() as View;
    setView(result); setError("");
    return result;
  }, []);
  useEffect(() => { const frame = requestAnimationFrame(() => { void refresh().catch((failure) => setError(failure instanceof Error ? failure.message : "Settings unavailable.")); }); return () => cancelAnimationFrame(frame); }, [refresh]);
  async function post(body: unknown) {
    const response = await fetch("/api/work/notification-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as View & { error?: string; message?: string };
    if (!response.ok) throw new Error(result.message ?? result.error ?? "Setting could not be saved.");
    setView(result); return result;
  }
  async function toggle(channel: Channel) {
    if (!view) return;
    setBusy(true); setMessage(""); setError("");
    try {
      await post({ action: "set-channels", channels: { ...view.settings.channels, [channel]: !view.settings.channels[channel] } });
      setMessage(`${channel === "sms" ? "SMS" : channel === "push" ? "Push" : "Email"} alerts ${view.settings.channels[channel] ? "turned off" : "turned on"}. New or changed bookings will follow this preference.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Setting could not be saved."); }
    finally { setBusy(false); }
  }
  async function registerPush() {
    if (!view?.available.push || !view.vapidPublicKey) return;
    setBusy(true); setMessage(""); setError("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser does not support push notifications.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Browser notification permission was not granted.");
      const registration = await navigator.serviceWorker.register("/d5o-crew-push-sw.js", { scope: "/work/" });
      const ready = await navigator.serviceWorker.ready;
      const subscription = await ready.pushManager.getSubscription() ?? await ready.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: decodeKey(view.vapidPublicKey)
      });
      await post({ action: "save-push", subscription: subscription.toJSON() });
      setMessage(`This browser is connected. Turn on Push alerts below to receive new or changed bookings.`);
      void registration;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Push registration failed."); }
    finally { setBusy(false); }
  }
  async function removePush() {
    setBusy(true); setMessage(""); setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/work/");
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
      await post({ action: "remove-push" });
      setMessage("Push alerts removed from this browser.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Push could not be removed."); }
    finally { setBusy(false); }
  }
  const channels: { key: Channel; label: string; detail: string; destination: string; ready: boolean }[] = view ? [
    { key: "email", label: "Email", detail: "Send a short notice to your verified account email.", destination: view.verifiedAccountContacts.email || "No eligible verified account email", ready: Boolean(view.verifiedAccountContacts.email && (!view.settings.channels.email || view.settings.email === view.verifiedAccountContacts.email)) },
    { key: "sms", label: "SMS", detail: "Send a short text to your verified account phone.", destination: view.verifiedAccountContacts.phone || "No verified account phone", ready: Boolean(view.verifiedAccountContacts.phone && (!view.settings.channels.sms || view.settings.phone === view.verifiedAccountContacts.phone)) },
    { key: "push", label: "Browser push", detail: "Show an alert on this browser, even when D5O is closed.", destination: view.settings.pushRegistered ? "This browser is connected" : "Connect this browser first", ready: view.settings.pushRegistered }
  ] : [];
  return <div className="d5o-notification-settings">
    <div className="d5o-notification-content"><div className="d5o-notification-intro"><p>ACCOUNT PREFERENCES · ALL WORKSPACES</p><h2>How should D5O reach you?</h2><span>Your booking appears in My crew schedule as soon as the scheduler saves it. These choices apply to your account in every workspace. External alerts are optional; you still accept or decline in D5O.</span></div>
      {error ? <p role="alert" className="d5o-notification-error">{error}</p> : null}{message ? <p role="status" className="d5o-notification-success">{message}</p> : null}
      {!view ? <section className="d5o-notification-card">Loading settings…</section> : <>
        {view.settings.legacyPreferencesNeedReview ? <p className="d5o-notification-review" role="status">Earlier workspace-specific alert choices are preserved but paused. Choose the channels you want for your account across all workspaces.</p> : null}
        <section className="d5o-notification-card"><div className="d5o-notification-section-head"><div><p>DELIVERY OPTIONS</p><h2>Crew booking alerts</h2></div><span>In-app schedule is always on</span></div>
          {channels.map((channel) => <div className="d5o-notification-channel" key={channel.key}><div><h3>{channel.label}</h3><p>{channel.detail}</p><small>{channel.destination}</small>{!view.available[channel.key] ? <em>Delivery provider is not configured for this prototype.</em> : !channel.ready ? <em>{view.settings.channels[channel.key] ? "Destination changed; alerts are paused. Turn off, then opt in again after verification." : "Requires a verified account destination or connected browser."}</em> : null}</div><div className="d5o-notification-channel-actions">{channel.key === "push" && view.available.push ? <button disabled={busy} onClick={() => void (view.settings.pushRegistered ? removePush() : registerPush())}>{view.settings.pushRegistered ? "Disconnect browser" : "Connect browser"}</button> : null}<button className={view.settings.channels[channel.key] ? "is-on" : ""} disabled={busy || (!view.settings.channels[channel.key] && (!view.available[channel.key] || !channel.ready))} onClick={() => void toggle(channel.key)} aria-pressed={view.settings.channels[channel.key]}>{view.settings.channels[channel.key] ? "On" : "Off"}</button></div></div>)}
        </section>
        <section className="d5o-notification-card"><div className="d5o-notification-section-head"><div><p>DELIVERY HISTORY · CURRENT WORKSPACE</p><h2>Recent external attempts</h2></div><button onClick={() => void refresh().catch((failure) => setError(failure instanceof Error ? failure.message : "Refresh failed."))}>Refresh</button></div>
          {view.deliveries.length ? <ul className="d5o-notification-history">{view.deliveries.map((entry, index) => <li key={`${entry.attemptedAt}-${index}`}><strong>{entry.channel === "sms" ? "SMS" : entry.channel === "push" ? "Push" : "Email"} · {entry.kind === "cancelled" ? "Cancelled" : "Updated"}</strong><span>{new Date(entry.attemptedAt).toLocaleString()}</span><em className={`is-${entry.state}`}>{entry.state === "sent" ? "Sent to provider" : entry.state === "failed" ? "Delivery failed" : "Outcome uncertain — review needed"}</em>{entry.error ? <small>{entry.error}</small> : null}</li>)}</ul> : <p className="d5o-notification-empty">No external alerts have been attempted. New or changed bookings will use the options you turn on here.</p>}
        </section>
      </>}
      <p className="d5o-notification-foot">Only account-verified contact details can receive email or SMS. Notifications contain no customer or site details. A booking or notification does not release controlled work.</p>
    </div>
  </div>;
}
