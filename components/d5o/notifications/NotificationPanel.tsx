"use client";

import type { OperatingNotification } from "@/lib/d5o/notifications/types";
import { NotificationCard } from "./NotificationCard";

type NotificationPanelProps = {
  notifications: OperatingNotification[];
  title?: string;
  limit?: number;
};

export function NotificationPanel({ notifications, title = "Notifications", limit = 6 }: NotificationPanelProps) {
  const visible = notifications.slice(0, limit);

  return (
    <section className="panel notification-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">In-App Alerts</p>
          <h2>{title}</h2>
        </div>
        <span className="muted">{visible.length} shown</span>
      </div>
      {visible.length > 0 ? (
        <div className="notification-stack">
          {visible.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      ) : (
        <p className="muted">No unresolved alerts for this view.</p>
      )}
    </section>
  );
}
