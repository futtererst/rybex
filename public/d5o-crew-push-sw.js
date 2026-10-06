self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = typeof payload.title === "string" ? payload.title : "Crew schedule updated";
  const body = typeof payload.body === "string" ? payload.body : "Sign in to review your booking.";
  event.waitUntil(self.registration.showNotification(title, { body, tag: "d5o-crew-schedule", data: { url: "/work/my-schedule" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin && new URL(client.url).pathname === "/work/my-schedule");
    if (existing) return existing.focus();
    return self.clients.openWindow("/work/my-schedule");
  }));
});
